/**
 * End-to-end verification of the data-attribute motion contract.
 *
 *   npm run test:motion          # build, then verify
 *   node tests/motion.e2e.mjs    # verify an existing dist/
 *
 * The check serves `dist/` over HTTP, loads every route in a real headless
 * Chrome/Edge, lets the GSAP engine settle under a virtual clock, and then
 * asserts against the serialized DOM:
 *
 *   1. `html.has-motion` was added, which only happens when a full init pass
 *      finished without the engine falling back to static content.
 *   2. Every `data-*` target declared in the markup was claimed by its own init
 *      pass (`data-motion-ready`, `data-parallax-ready`, …). An unclaimed
 *      `[data-reveal-item]` would stay `visibility: hidden` forever, so this is
 *      the invariant that proves nothing is left invisible.
 *   3. GSAP really wrote inline styles (tweens exist) and the above-the-fold
 *      hero/word reveals ran well past their from-state. Chrome starves its
 *      virtual clock mid-tween, so "finished" is not reliably observable; the
 *      bounds in ROUTES and `WORD_REVEAL_FLOOR` encode the reachable envelope.
 *   4. Reduced motion boots the static path: no `has-motion`, no claims.
 *   5. The pinned horizontal gallery only claims from `lg` up.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const distDir = path.join(root, "dist");
// Virtual milliseconds the page gets to run; the hero timeline alone needs ~1.6s.
const VIRTUAL_TIME_BUDGET = Number(process.env.MOTION_TEST_BUDGET) || 20000;
const BROWSER_TIMEOUT = Number(process.env.MOTION_TEST_TIMEOUT) || 30000;
const BROWSER_ATTEMPTS = Number(process.env.MOTION_TEST_ATTEMPTS) || 3;
/** `MOTION_TEST_ONLY=home` runs a single route while debugging. */
const ONLY_ROUTE = process.env.MOTION_TEST_ONLY;
/** `MOTION_TEST_WIDTH=1000` overrides every route width while debugging. */
const WIDTH_OVERRIDE = Number(process.env.MOTION_TEST_WIDTH) || 0;
/**
 * Lowest `.motion-word` opacity that still counts as revealed. Chrome starves its
 * virtual clock mid-tween (see the hero note in ROUTES), so a word reveal is
 * asserted as "well past its from-state" (`autoAlpha: 0`) rather than exactly
 * finished — the same tolerance the hero timeline already uses.
 */
const WORD_REVEAL_FLOOR = 0.45;

const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const browserPath = browserCandidates.find((candidate) =>
  existsSync(candidate),
);

if (!browserPath) {
  console.error(
    "[motion] no Chrome/Edge binary found — set CHROME_PATH to run this check",
  );
  process.exit(2);
}
if (!existsSync(path.join(distDir, "index.html"))) {
  console.error(
    "[motion] dist/index.html is missing — run `npm run build` first",
  );
  process.exit(2);
}

/* -------------------------------- assertions ------------------------------- */

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ----------------------------------- dom ----------------------------------- */

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Drops inline <script>/<style> so bundled source text cannot look like markup. */
function stripBundles(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}

/**
 * Every opening tag carrying `attribute` as a real attribute. Matching on
 * `attribute="` keeps `data-reveal` from matching `data-reveal-item`/`-delay`
 * and `data-cursor` from matching `data-cursor-label`.
 */
function tagsWith(html, attribute) {
  return (
    html.match(new RegExp(`<[a-zA-Z][^>]*\\b${attribute}="[^>]*>`, "g")) ?? []
  );
}

function claimedCount(html, attribute, claim) {
  return tagsWith(html, attribute).filter((tag) => tag.includes(claim)).length;
}

/* ---------------------------------- server --------------------------------- */

/**
 * Backend the audit proxies `/api/*` to. The bundle is built with a *relative*
 * API base (`VITE_API_BASE_URL=/api`), so a served `dist` has no backend behind
 * it: without this proxy every audited route renders the empty catalogue state
 * and the motion contract is checked against placeholder markup instead of the
 * real content. Point it elsewhere with `MOTION_TEST_API`.
 */
const API_ORIGIN = process.env.MOTION_TEST_API ?? "http://127.0.0.1:5000";
/** Upstream budget; a sleeping backend must not stall the whole audit. */
const API_TIMEOUT = 5000;

/**
 * Streams one API request to the backend. When the backend is down the upstream
 * errors out immediately and the app falls back to the same empty catalogue
 * state it renders when the proxy is not there at all.
 */
function proxyApi(request, response) {
  const upstream = httpRequest(new URL(request.url ?? "/", API_ORIGIN), {
    method: request.method,
    headers: { ...request.headers, host: new URL(API_ORIGIN).host },
  });
  upstream.setTimeout(API_TIMEOUT, () => upstream.destroy());
  upstream.on("response", (upstreamResponse) => {
    response.writeHead(
      upstreamResponse.statusCode ?? 502,
      upstreamResponse.headers,
    );
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end("upstream unavailable");
  });
  request.pipe(upstream);
}

/**
 * The catalogue lives in the backend now, so the `product` route asks the live
 * API for a slug that actually exists instead of pinning one that only matched
 * the retired static catalogue. Unreachable API ⇒ the original slug is kept, so
 * the route still audits the not-found page rather than silently skipping.
 */
async function resolveProductUrl(fallback) {
  try {
    const response = await fetch(`${API_ORIGIN}/api/public/menu`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return fallback;
    const payload = await response.json();
    const slug = payload?.items?.find(
      (item) => typeof item?.slug === "string" && item.slug.length > 0,
    )?.slug;
    return slug ? `/menu/${encodeURIComponent(slug)}` : fallback;
  } catch {
    return fallback;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (url.pathname.startsWith("/api/")) {
          proxyApi(request, response);
          return;
        }
        let filePath = path.join(distDir, decodeURIComponent(url.pathname));
        let info = await stat(filePath).catch(() => null);
        if (!info || info.isDirectory()) {
          filePath = path.join(distDir, "index.html");
          info = await stat(filePath);
        }
        const body = await readFile(filePath);
        response.writeHead(200, {
          "content-type":
            MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream",
          "content-length": body.length,
        });
        response.end(body);
      } catch {
        response.writeHead(404).end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

/* --------------------------------- browser --------------------------------- */

function runBrowser(
  url,
  { width, height = 900, reducedMotion = false, profileDir },
) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-pings",
      "--hide-scrollbars",
      // Fail every remote host instantly so pending image/font fetches cannot
      // hold the virtual clock open — while keeping the local test server alive.
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      `--user-data-dir=${profileDir}`,
      `--window-size=${width},${height}`,
      `--virtual-time-budget=${VIRTUAL_TIME_BUDGET}`,
    ];
    if (reducedMotion) args.push("--force-prefers-reduced-motion");
    args.push("--dump-dom", url);

    const child = spawn(browserPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let dom = "";
    let diagnostics = "";
    const timer = setTimeout(() => {
      diagnostics += "\n[browser] timed out";
      killTree(child);
    }, BROWSER_TIMEOUT);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      dom += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      diagnostics += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", () => {
      clearTimeout(timer);
      // Chrome can leave helper processes behind; they break later launches.
      killTree(child);
      resolve({ dom, diagnostics });
    });
  });
}

/** Kills a browser process and its renderer/GPU children. */
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

/**
 * Retries a flaky headless launch until the dump is worth auditing. `ready`
 * decides that: the app booting is not enough on its own, because `Layout`
 * paints the shell (and `has-motion`) while `<Suspense>` still stands in the
 * page content with `PageLoader`.
 */
async function loadRoute(
  url,
  { width, profileDir, reducedMotion = false, ready },
) {
  let last = { dom: "", diagnostics: "" };
  for (let attempt = 0; attempt < BROWSER_ATTEMPTS; attempt += 1) {
    last = await runBrowser(url, {
      width,
      reducedMotion,
      profileDir: `${profileDir}-${attempt}`,
    });
    if (ready(last.dom)) return last;
  }
  return last;
}

/* --------------------------------- contract -------------------------------- */

const CONTRACT = [
  ["data-hero", "data-motion-ready"],
  ["data-motion-text", "data-motion-ready"],
  ["data-reveal-group", "data-motion-ready"],
  ["data-reveal", "data-motion-ready"],
  ["data-reveal-item", "data-motion-ready"],
  ["data-image-reveal", "data-motion-ready"],
  ["data-parallax-image", "data-parallax-ready"],
  ["data-progress-bar", "data-progress-ready"],
  ["data-magnetic", "data-magnetic-ready"],
  ["data-mouse-parallax", "data-mouse-ready"],
  ["data-horizontal-gallery", "data-gallery-ready"],
];

const claimFor = (target) =>
  CONTRACT.find(([name]) => name === target)?.[1] ?? "";

/**
 * Targets that may legitimately stay unclaimed: the pinned rail is media-gated,
 * so below `lg` it is intentionally left dormant. It is not CSS-hidden, so an
 * unclaimed rail never leaves content invisible — the route rules below still
 * assert it is claimed on `lg` and dormant below it.
 */
const MEDIA_GATED = new Set(["data-horizontal-gallery"]);

const ROUTES = [
  {
    name: "home",
    url: "/",
    width: 1440,
    require: {
      "data-hero": 1,
      "data-horizontal-gallery": 1,
      "data-mouse-parallax": 1,
      "data-parallax-image": 1,
      "data-magnetic": 1,
      "data-motion-text": 1,
      "data-reveal-group": 1,
      "data-reveal-item": 1,
      "data-image-reveal": 1,
    },
    // ScrollTrigger wraps a pinned trigger in a `pin-spacer`, which only appears
    // once the rail actually has horizontal distance to travel.
    pinned: true,
    // Chrome stops advancing its virtual clock after ~1.3–1.6s of continuous rAF
    // work (starvation guard), so the 1.58s hero timeline is verified as "well past
    // its from-state" instead of "exactly finished".
    animated: [
      {
        target: "data-hero-media",
        numeric: { blur: { max: 9 }, opacity: { min: 0.45 } },
      },
      { target: "data-hero-wordmark", numeric: { opacity: { min: 0.7 } } },
    ],
  },
  {
    name: "menu",
    url: "/menu",
    width: 1440,
    require: {
      "data-reveal-group": 1,
      "data-reveal-item": 1,
      "data-image-reveal": 1,
      "data-motion-text": 1,
    },
    words: true,
  },
  {
    name: "product",
    url: "/menu/smoky-smash",
    width: 1440,
    require: {
      "data-reveal-group": 1,
      "data-reveal-item": 1,
      "data-image-reveal": 1,
      "data-motion-text": 1,
      "data-magnetic": 1,
    },
  },
  {
    name: "loyalty",
    url: "/loyalty",
    width: 1440,
    require: {
      "data-progress-bar": 1,
      "data-reveal-group": 1,
      "data-reveal-item": 1,
      "data-motion-text": 1,
      "data-magnetic": 1,
    },
    animated: [{ target: "data-progress-bar", contains: ["transform"] }],
  },
  {
    name: "blog",
    url: "/blog",
    width: 1440,
    require: {
      "data-reveal-group": 1,
      "data-reveal-item": 1,
      "data-image-reveal": 1,
      "data-motion-text": 1,
    },
  },
  {
    name: "blog post",
    url: "/blog/inside-the-kitchen",
    width: 1440,
    require: {
      "data-reveal-group": 1,
      "data-reveal-item": 1,
      "data-image-reveal": 1,
      "data-parallax-image": 1,
      "data-motion-text": 1,
    },
    animated: [{ target: "data-parallax-image", contains: ["transform"] }],
  },
  {
    // Below `lg` the pinned rail must stay dormant while the rest still animates.
    name: "home (sm)",
    url: "/",
    width: 800,
    require: { "data-hero": 1, "data-reveal-item": 1 },
    forbid: { "data-horizontal-gallery": 0 },
  },
];

/* ---------------------------------- audit ---------------------------------- */

function tagsWithClass(html, className) {
  return (
    html.match(new RegExp(`<[a-zA-Z][^>]*class="${className}"[^>]*>`, "g")) ??
    []
  );
}

/** Highest `opacity` GSAP has written onto any `.motion-word` (0 if none). */
function wordRevealOpacity(markup) {
  const opacities = tagsWithClass(markup, "motion-word")
    .map((word) => Number(word.match(/opacity:\s*([\d.]+)/)?.[1] ?? Number.NaN))
    .filter(Number.isFinite);
  return opacities.length ? Math.max(...opacities) : 0;
}

/**
 * Whether the dump is worth auditing. The first motion pass adds `has-motion`
 * before a lazily imported page chunk resolves, so presence of the shell is not
 * proof the route rendered — every declared target has to be in the markup.
 * Routes that assert their above-the-fold word reveal also wait for it to
 * finish, so a starved attempt is retried instead of being audited mid-tween.
 */
function routeReady(dom, route) {
  const markup = stripBundles(dom);
  const declared = Object.keys(route.require ?? {});
  if (!declared.every((target) => tagsWith(markup, target).length > 0))
    return false;
  return !route.words || wordRevealOpacity(markup) === 1;
}

function audit(route, dom) {
  const markup = stripBundles(dom);
  const label = `${route.name} @${route.width}px`;

  check(
    `${label}: engine booted (html.has-motion)`,
    /<html[^>]*class="[^"]*has-motion/.test(markup),
  );
  check(
    `${label}: custom cursor is mounted`,
    tagsWith(markup, "data-cursor").length === 1,
  );

  // Nothing may stay hidden: every declared target has to carry its claim.
  for (const [target, claim] of CONTRACT) {
    if (MEDIA_GATED.has(target)) continue;
    const declared = tagsWith(markup, target).length;
    const claimed = claimedCount(markup, target, claim);
    check(
      `${label}: all ${declared}× ${target} claimed via ${claim}`,
      declared === claimed,
      `${claimed}/${declared}`,
    );
  }

  for (const [target, minimum] of Object.entries(route.require ?? {})) {
    const claimed = claimedCount(markup, target, claimFor(target));
    check(
      `${label}: ${target} animates (>=${minimum})`,
      claimed >= minimum,
      `claimed ${claimed}`,
    );
  }

  for (const [target, maximum] of Object.entries(route.forbid ?? {})) {
    const claimed = claimedCount(markup, target, claimFor(target));
    check(
      `${label}: ${target} stays dormant (<=${maximum})`,
      claimed <= maximum,
      `claimed ${claimed}`,
    );
  }

  for (const evidence of route.animated ?? []) {
    const [tag] = tagsWith(markup, evidence.target);
    check(`${label}: ${evidence.target} carries a live tween`, Boolean(tag));
    for (const fragment of evidence.contains ?? []) {
      check(
        `${label}: ${evidence.target} inline style contains "${fragment}"`,
        Boolean(tag?.includes(fragment)),
        tag ? tag.slice(0, 200) : "target not found",
      );
    }
    if (evidence.numeric) {
      const values = {
        blur: Number(tag?.match(/blur\(([\d.]+)px\)/)?.[1] ?? Number.NaN),
        opacity: Number(tag?.match(/opacity:\s*([\d.]+)/)?.[1] ?? Number.NaN),
      };
      for (const [property, bound] of Object.entries(evidence.numeric)) {
        const value = values[property];
        const withinBounds =
          Number.isFinite(value) &&
          (bound.min === undefined || value >= bound.min) &&
          (bound.max === undefined || value <= bound.max);
        const expectation = [
          bound.min === undefined ? null : `>=${bound.min}`,
          bound.max === undefined ? null : `<=${bound.max}`,
        ]
          .filter(Boolean)
          .join(" and ");
        check(
          `${label}: ${evidence.target} ${property} ${expectation}`,
          withinBounds,
          `${property}=${value}`,
        );
      }
    }
  }

  if (route.pinned) {
    check(
      `${label}: the rail is pinned by ScrollTrigger`,
      markup.includes("pin-spacer"),
    );
  }

  if (route.words) {
    const words = tagsWithClass(markup, "motion-word");
    const tweened = words.filter((word) => word.includes("transform:"));
    const opacity = wordRevealOpacity(markup);
    check(
      `${label}: masked words were rendered`,
      words.length > 0,
      `found ${words.length}`,
    );
    check(
      `${label}: an above-the-fold word reveal ran`,
      tweened.length > 0 && opacity >= WORD_REVEAL_FLOOR,
      `${words.length} words checked, opacity=${opacity}`,
    );
  }
}

function auditReducedMotion(dom) {
  const markup = stripBundles(dom);
  check(
    "reduced motion: html.has-motion is never added",
    !/<html[^>]*class="[^"]*has-motion/.test(markup),
  );
  check(
    "reduced motion: cursor element is still rendered",
    tagsWith(markup, "data-cursor").length === 1,
  );
  const claimed = CONTRACT.reduce(
    (total, [target, claim]) => total + claimedCount(markup, target, claim),
    0,
  );
  check(
    "reduced motion: nothing is claimed by the engine",
    claimed === 0,
    `found ${claimed} claims`,
  );
}

/* ----------------------------------- main ---------------------------------- */

const server = await startServer();
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const profilesRoot = await mkdtemp(
  path.join(tmpdir(), "شیش برگر الین-motion-"),
);

console.log(`[motion] browser ${browserPath}`);
console.log(`[motion] serving ${path.relative(root, distDir)} at ${origin}`);

try {
  const routes = ONLY_ROUTE
    ? ROUTES.filter((route) => route.name.includes(ONLY_ROUTE))
    : ROUTES;

  // Audit the product route against a product the live catalogue really has.
  const productRoute = routes.find((route) => route.name === "product");
  if (productRoute) productRoute.url = await resolveProductUrl(productRoute.url);
  if (productRoute) console.log(`[motion] product route ${productRoute.url}`);

  for (const route of routes) {
    const slug = route.name.replace(/\W+/g, "-");
    const { dom, diagnostics } = await loadRoute(`${origin}${route.url}`, {
      width: WIDTH_OVERRIDE || route.width,
      profileDir: path.join(profilesRoot, slug),
      ready: (dom) => routeReady(dom, route),
    });
    if (!dom.includes("has-motion") && !dom.includes("data-reveal")) {
      console.error(
        `[motion] ${route.name}: browser returned no app markup\n${diagnostics.slice(0, 800)}`,
      );
    }
    audit(route, dom);
    console.log(
      `[motion] ${route.name} @${WIDTH_OVERRIDE || route.width}px checked`,
    );
  }

  const reduced = await loadRoute(`${origin}/`, {
    width: 1440,
    reducedMotion: true,
    profileDir: path.join(profilesRoot, "reduced"),
    ready: (dom) => dom.includes("data-reveal"),
  });
  auditReducedMotion(reduced.dom);
  console.log("[motion] reduced-motion pass checked");

  const shell = await readFile(path.join(distDir, "index.html"), "utf8");
  check(
    "bundle: hidden-state CSS shipped",
    shell.includes("has-motion [data-motion-text]"),
  );
  check("bundle: word-mask CSS shipped", shell.includes("motion-word-mask"));
  check("bundle: smooth-scroll CSS shipped", shell.includes("lenis"));
} finally {
  server.close();
  await rm(profilesRoot, { recursive: true, force: true });
}

const total = passed + failures.length;
if (failures.length) {
  console.error(`\n[motion] ${failures.length}/${total} checks failed:`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}
console.log(`\n[motion] all ${total} checks passed`);
