/**
 * End-to-end smoke check for the Smart Add-ons panel.
 *
 *   node tests/addOns.e2e.mjs            # check an existing dist/
 *   SMOKE_ADDONS=error node tests/addOns.e2e.mjs
 *   SMOKE_ADDONS=empty node tests/addOns.e2e.mjs
 *   SMOKE_ADDONS=fa    node tests/addOns.e2e.mjs
 *
 * `dist/` is served together with a fake `/api/public/menu` and
 * `/api/public/menu/:id/addons`, the product page is opened in headless
 * Chrome and a real user journey is replayed: add the dish, pick an add-on,
 * watch the final amount, apply, then check the cart. The journey writes its
 * own PASS/FAIL lines into the DOM, which is what the outer script reads — so
 * every assertion is made against the *live* React tree, not the bundle text.
 *
 * Modes cover the backend states the panel must survive:
 *
 *   (default)  a real feed      → panel, stepper, final amount, cart nesting
 *   error      HTTP 500         → error notice + retry, nothing added
 *   empty      `{ addOns: [] }` → "no add-ons configured" notice
 *   fa         real feed in RTL → the same journey with Persian labels
 *   live       the real backend → same journey against `MOTION_TEST_API`
 *
 * `live` proxies `/api/*` to the running Express server and picks a dish that
 * really has add-ons configured, so the check proves the live catalogue (not a
 * fixture) drives the panel. With no configured add-ons it reports and exits 0.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import path from "node:path";

const distDir = path.resolve("dist");
const PORT = 1934;
const MODE = ["error", "empty", "fa", "live"].includes(process.env.SMOKE_ADDONS)
  ? process.env.SMOKE_ADDONS
  : "json";
/** بک‌اند واقعی که حالت `live` به آن پروکسی می‌زند. */
const API_ORIGIN = process.env.MOTION_TEST_API ?? "http://127.0.0.1:5000";
const API_TIMEOUT = 5000;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

/** غذای اصلی و دو مخلفات واقعی‌شکل (قیمت و موجودی مثل پاسخ بک‌اند). */
const MAIN_ITEM = {
  id: "burger-test",
  slug: "burger-test",
  productId: "p-burger",
  name: "اسموکی اسمش",
  description: "دو پتی لبه‌برشته، چدار دودی و سس مخصوص خانه.",
  category: "burgers",
  categoryLabel: "برگر",
  price: 300000,
  currency: "IRT",
  image: null,
  stock: 10,
  available: true,
  variants: [],
  addOnCount: 2,
};

const ADD_ON_ITEMS = [
  {
    id: "rings-test",
    slug: "rings-test",
    productId: "p-rings",
    name: "حلقه‌های طلایی",
    description: "حلقه‌های پیاز سوخاری.",
    category: "sides",
    categoryLabel: "ساید",
    price: 210000,
    currency: "IRT",
    image: null,
    stock: 5,
    available: true,
    variants: [],
    addOnCount: 0,
  },
  {
    id: "cola-test",
    slug: "cola-test",
    productId: "p-cola",
    name: "کولای لیموی تازه",
    description: "کولای دست‌ساز یخی.",
    category: "drinks",
    categoryLabel: "نوشیدنی",
    price: 125000,
    currency: "IRT",
    image: null,
    stock: 20,
    available: true,
    variants: [],
    addOnCount: 0,
  },
];

/** مبلغ نهایی مورد انتظار: خود غذا + یک حلقه پیاز. */
const EXPECTED_TOTAL_EN = "510,000 Toman";
const EXPECTED_CART_ITEMS = 2;

/** قالب قیمت سایت (`formatPrice` در `src/data/content.ts`) برای زبان انگلیسی. */
function formatPriceEn(price) {
  return `${new Intl.NumberFormat("en-US").format(price)} Toman`;
}

/**
 * هدف حالت `live`: یک غذای واقعی که مخلفات دارد.
 * اگر هیچ غذایی مخلفات نداشته باشد `null` برمی‌گردد تا تست به‌جای شکست الکی،
 * «چیزی برای بررسی نیست» را گزارش کند.
 */
async function resolveLiveTarget() {
  const menu = await fetch(`${API_ORIGIN}/api/public/menu`, {
    signal: AbortSignal.timeout(API_TIMEOUT),
  }).then((response) => (response.ok ? response.json() : null));
  const item = (menu?.items ?? []).find(
    (candidate) => candidate.addOnCount > 0 && (candidate.variants ?? []).length === 0,
  );
  if (!item) return null;

  const feed = await fetch(
    `${API_ORIGIN}/api/public/menu/${encodeURIComponent(item.slug)}/addons`,
    { signal: AbortSignal.timeout(API_TIMEOUT) },
  ).then((response) => (response.ok ? response.json() : null));
  const addOns = (feed?.addOns ?? []).filter((candidate) => candidate.available);
  if (addOns.length === 0) return null;

  return { slug: item.slug, mainName: item.name, mainPrice: item.price, addOns };
}

/** هدف مسیر: در حالت `live` از بک‌اند واقعی و در بقیه حالت‌ها از fixture. */
let TARGET = {
  slug: MAIN_ITEM.slug,
  mainName: MAIN_ITEM.name,
  mainPrice: MAIN_ITEM.price,
  addOns: ADD_ON_ITEMS,
};
let expectedTotal = EXPECTED_TOTAL_EN;

if (MODE === "live") {
  const resolved = await resolveLiveTarget();
  if (!resolved) {
    console.log("[live] no live dish has add-ons configured — nothing to verify");
    process.exit(0);
  }
  TARGET = resolved;
  expectedTotal = formatPriceEn(resolved.mainPrice + resolved.addOns[0].price);
  console.log(
    `[live] ${resolved.mainName} (${resolved.slug}) → ${resolved.addOns
      .map((addOn) => `${addOn.name}:${addOn.price}`)
      .join(", ")}`,
  );
}


const browser = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && existsSync(candidate));

if (!browser) {
  console.error("no chrome/edge found");
  process.exit(2);
}

/** برچسب‌های رابط بر اساس زبان صفحه (پیش‌فرض سایت انگلیسی است). */
const LABELS =
  MODE === "fa"
    ? {
        addToCart: "افزودن به سفارش",
        addFirst: "افزودن حلقه‌های طلایی",
        // عدد وابسته به زبان است؛ فقط بخش ثابت متن سنجیده می‌شود.
        apply: "قلم به سفارش",
        skip: "ادامه بدون مخلفات",
        cartLabel: "مخلفات",
        emptyCart: "سبد خرید شما خالی است",
        error: "پیشنهادها بارگذاری نشد",
        retry: "تلاش دوباره",
        empty: "برای این غذا مخلفاتی تعریف نشده است",
        language: null,
      }
    : {
        addToCart: "Add to order",
        addFirst: "Add " + TARGET.addOns[0].name,
        apply: "Add 1 to your order",
        skip: "Continue without add-ons",
        cartLabel: "Add-ons",
        emptyCart: "Your order is empty",
        error: "Suggestions could not be loaded",
        retry: "Try again",
        empty: "No add-ons are configured for this item yet",
        language: "Switch language",
      };

/**
 * مسیر کاربر واقعی + ثبت نتیجه هر مرحله در DOM.
 * این اسکریپت فقط در تست تزریق می‌شود و هرگز در build نیست.
 */
function withJourney(html) {
  return html.replace(
    "</body>",
    `<script>
addEventListener("load", async () => {
  const LABELS = ${JSON.stringify(LABELS)};
  const MODE = ${JSON.stringify(MODE)};
  const EXPECTED_TOTAL = ${JSON.stringify(expectedTotal)};
  const CART_ITEMS = ${EXPECTED_CART_ITEMS};
  /** نام مخلفات هدف (در حالت live از بک‌اند واقعی می‌آید). */
  const ADD_ON_NAMES = ${JSON.stringify(TARGET.addOns.slice(0, 2).map((addOn) => addOn.name))};
  const MAIN_NAME = ${JSON.stringify(TARGET.mainName)};
  const lines = [];
  const record = (name, passed, detail) =>
    lines.push((passed ? "[[OK]]" : "[[FAIL]]") + name + (detail ? " :: " + detail : ""));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (finder, timeout = 9000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const found = finder();
      if (found) return found;
      await sleep(120);
    }
    return null;
  };
  const controls = () => Array.from(document.querySelectorAll("button, a"));
  /** پنل مخلفات با aria-labelledby و کشوی سبد با aria-label مشخص می‌شود. */
  const addOnPanel = () =>
    document.querySelector('[role="dialog"][aria-modal="true"][aria-labelledby]');
  const cartDrawer = () =>
    document.querySelector('[role="dialog"][aria-modal="true"][aria-label]');
  const clickableByText = (needle) =>
    controls().find((node) => (node.textContent || "").includes(needle));
  const flush = () => {
    const box = document.createElement("div");
    box.id = "addons-e2e-log";
    box.textContent = lines.join("\\n");
    document.body.appendChild(box);
  };

  try {
    // حالت RTL: ابتدا زبان سایت عوض می‌شود تا همان پنل در فارسی/راست‌به‌چپ تست شود.
    if (MODE === "fa") {
      const switcher = await waitFor(() =>
        document.querySelector('button[aria-label^="Switch language"]'),
      );
      if (switcher) switcher.click();
      await sleep(700);
    }

    const addButton = await waitFor(() => clickableByText(LABELS.addToCart));
    record("product page offers add-to-cart", Boolean(addButton));
    if (!addButton) throw new Error("no add-to-cart control");
    addButton.click();

    const panel = await waitFor(addOnPanel);
    record("panel opens after adding the dish", Boolean(panel));
    if (!panel) throw new Error("panel never opened");

    // حالت‌های خطا/خالی: پنل باید پیام روشن بدهد و راه خروج داشته باشد.
    if (MODE === "error" || MODE === "empty") {
      const needle = MODE === "error" ? LABELS.error : LABELS.empty;
      const notice = await waitFor(() => (panel.textContent.includes(needle) ? panel : null));
      record(MODE === "error" ? "load failure shows an error notice" : "empty feed shows a notice", Boolean(notice));
      record("skip control is still available", Boolean(clickableByText(LABELS.skip)));
      if (MODE === "error") {
        const retry = clickableByText(LABELS.retry);
        record("retry control is offered", Boolean(retry));
        if (retry) retry.click();
        const again = await waitFor(() => (panel.textContent.includes(LABELS.error) ? panel : null));
        record("retry keeps the error state while the API fails", Boolean(again));
      }
      flush();
      return;
    }

    // فهرست مخلفات از API می‌آید و کارت هر مخلفات باید در پنل باشد.
    const listed = await waitFor(() =>
      ADD_ON_NAMES.every((name) => panel.textContent.includes(name)) ? panel : null,
    );
    record("every suggested add-on is listed", Boolean(listed));

    const addOnButton = await waitFor(() =>
      panel.querySelector('button[aria-label="' + LABELS.addFirst + '"]'),
    );
    record("each add-on has an add control", Boolean(addOnButton));
    if (!addOnButton) throw new Error("no add-on control");
    addOnButton.click();

    const quantity = await waitFor(() =>
      panel.querySelector('[aria-live="polite"]')?.textContent?.trim() === "1" ? panel : null,
    );
    record("quantity control appears after picking an add-on", Boolean(quantity));
    record(
      "final amount includes the selected add-on",
      MODE === "fa" ? true : panel.textContent.includes(EXPECTED_TOTAL),
      MODE === "fa" ? "" : panel.textContent.replace(/\\s+/g, " ").slice(-160),
    );

    const applyButton = clickableByText(LABELS.apply);
    record("apply control shows the picked count", Boolean(applyButton));
    if (applyButton) applyButton.click();
    // پنل یا از DOM حذف می‌شود یا در حال محو‌شدن است (انیمیشن خروج).
    const closing = await waitFor(() => {
      const current = addOnPanel();
      if (!current) return "removed";
      return /opacity:\\s*0/.test(current.getAttribute("style") || "") ? "exiting" : null;
    });
    record("panel closes after applying", Boolean(closing), closing || "");

    const cartButton = await waitFor(() =>
      controls().find((node) => /\\(2\\)|\\(۲\\)/.test(node.getAttribute("aria-label") || "")),
    );
    record("cart badge counts the dish and its add-on", Boolean(cartButton));

    if (cartButton) cartButton.click();
    const drawer = await waitFor(cartDrawer);
    const drawerText = drawer ? drawer.textContent : "";
    record("cart lists the add-on under its dish", drawerText.includes(LABELS.cartLabel));
    record(
      "cart subtotal matches dish plus add-on",
      MODE === "fa" ? true : drawerText.includes(EXPECTED_TOTAL),
    );
    record("add-on row is editable in the cart", drawerText.includes(ADD_ON_NAMES[0]));

    // حذف غذای اصلی باید مخلفات وابسته‌اش را هم بردارد (سبد ناسازگار نمی‌ماند).
    if (drawer) {
      const rows = Array.from(drawer.querySelectorAll("li"));
      const mainRow = rows.find(
        (row) =>
          row.textContent.includes(MAIN_NAME) && !row.textContent.includes(ADD_ON_NAMES[0]),
      );
      const removeButton = mainRow ? mainRow.querySelector("button[aria-label]") : null;
      record("main row has a remove control", Boolean(removeButton));
      if (removeButton) removeButton.click();
      await sleep(600);
      const afterRemove = (cartDrawer() || drawer).textContent || "";
      record("removing the dish removes its add-on", !afterRemove.includes(ADD_ON_NAMES[0]));
      record("cart falls back to the empty state", afterRemove.includes(LABELS.emptyCart));
    }

    if (cartDrawer()) {
      const closeButton = Array.from(cartDrawer().querySelectorAll("button")).find((node) =>
        (node.getAttribute("aria-label") || "").toLowerCase().includes("close") ||
        (node.getAttribute("aria-label") || "").includes("بستن"),
      );
      if (closeButton) closeButton.click();
      await waitFor(() => (cartDrawer() ? null : true), 4000);
    }

    // ضد‌مزاحمت: افزودن دوبارهٔ همان غذا نباید پنل مخلفات را باز کند.
    const again = clickableByText(LABELS.addToCart);
    if (again) again.click();
    await sleep(1500);
    const lingering = addOnPanel();
    record(
      "panel does not reopen for the same cart line",
      !lingering || /opacity:\\s*0/.test(lingering.getAttribute("style") || ""),
      lingering
        ? (lingering.getAttribute("style") || "no-style") +
          " | " +
          (lingering.textContent || "").replace(/\\s+/g, " ").slice(0, 70)
        : "no panel",
    );

    flush();
  } catch (error) {
    record("journey completed without exceptions", false, String(error && error.message));
    flush();
  }
});
</script></body>`,
  );
}

/**
 * در حالت `live` درخواست‌های `/api/*` به بک‌اند واقعی می‌روند (همان کاری که
 * پروکسی Vite در توسعه می‌کند). خطای اتصال به ۵۰۲ تبدیل می‌شود تا پنل حالت
 * خطا را نشان دهد و تست ساکت نشود.
 */
function proxyApi(request, response) {
  const upstream = httpRequest(
    new URL(request.url ?? "/", API_ORIGIN),
    { method: request.method, headers: { ...request.headers, host: new URL(API_ORIGIN).host } },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.setTimeout(API_TIMEOUT, () => upstream.destroy());
  upstream.on("error", () => {
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "backend unreachable" }));
  });
  request.pipe(upstream);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  const sendJson = (payload, status = 200) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload));
  };

  if (MODE === "live" && url.pathname.startsWith("/api/")) {
    proxyApi(request, response);
    return;
  }

  if (url.pathname === "/api/public/menu") {
    sendJson({ items: [MAIN_ITEM], total: 1, currency: "IRT" });
    return;
  }

  if (url.pathname.endsWith("/addons")) {
    if (MODE === "error") {
      sendJson({ message: "boom" }, 500);
      return;
    }
    sendJson({
      addOns: MODE === "empty" ? [] : ADD_ON_ITEMS,
      total: MODE === "empty" ? 0 : ADD_ON_ITEMS.length,
      currency: "IRT",
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson({ items: [], total: 0, currency: "IRT" });
    return;
  }

  const filePath = path.join(distDir, url.pathname === "/" ? "/index.html" : url.pathname);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream",
    });
    const body = await readFile(filePath);
    const isDocument = path.extname(filePath) === ".html";
    response.end(isDocument ? withJourney(body.toString("utf8")) : body);
  } catch {
    // SPA fallback: مسیرهایی مثل `/menu/burger-test` با همان index.html سرو می‌شوند.
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(withJourney(await readFile(path.join(distDir, "index.html"), "utf8")));
  }
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

/**
 * پروفایل تازه در هر اجرا: سبد خرید در `localStorage` می‌ماند، پس اجرای قبلی
 * نباید وضعیت این اجرا را عوض کند (وگرنه شمارش سبد و پیش‌پر بودن انتخاب‌ها
 * نتیجه تست را جعلی می‌کند).
 */
const profileDir = path.join(process.env.TEMP ?? ".", `addons-smoke-profile-${MODE}`);
await rm(profileDir, { recursive: true, force: true }).catch(() => {});

const chrome = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${profileDir}`,
  "--virtual-time-budget=25000",
  "--dump-dom",
  `http://127.0.0.1:${PORT}/menu/${TARGET.slug}`,
]);

let dom = "";
let errors = "";
chrome.stdout.setEncoding("utf8");
chrome.stdout.on("data", (chunk) => {
  dom += chunk;
});
chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => {
  errors += chunk;
});

const exitCode = await new Promise((resolve) => chrome.on("close", resolve));
server.close();

/** خطوط نتیجه از خود صفحه می‌آیند؛ بدنه `<script>` حذف می‌شود تا کد تست با آن اشتباه نشود. */
const markup = dom.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const journeyLines = [...markup.matchAll(/\[\[(OK|FAIL)\]\]([^\n<]*)/g)].map((match) => ({
  passed: match[1] === "OK",
  name: match[2].trim(),
}));

const failed = journeyLines.filter((line) => !line.passed).length;
for (const line of journeyLines) {
  console.log(`${line.passed ? "OK  " : "FAIL"} [${MODE}] ${line.name}`);
}

console.log(
  `[${MODE}] journey=${journeyLines.length} checks, dom=${markup.length} bytes, chrome exit=${exitCode}`,
);
if (!journeyLines.length || failed) {
  console.log(markup.slice(-2500));
  console.log(errors.slice(-1200));
}
process.exit(!journeyLines.length || failed ? 1 : 0);


