/**
 * End-to-end smoke check for the Table Talk section on the home page.
 *
 *   npm run test:tabletalk:e2e     # build, then check the API feed
 *   node tests/tableTalk.e2e.mjs   # check an existing dist/
 *
 * `dist/` is served together with a fake `/api/public/testimonials`, `/` is
 * rendered in headless Chrome and the *rendered* DOM is asserted. The
 * single-file build inlines the locale JSON, so `<script>` bodies are stripped
 * first and every needle is compared against real markup.
 *
 * Three modes, because the section must survive every backend state:
 *
 *   (default)                a real JSON feed → quote, rating, counter
 *   SMOKE_TABLETALK=empty    `{ items: [], total: 0 }` → the whole section hides
 *   SMOKE_TABLETALK=error    HTTP 500 → quiet notice + retry button
 *
 * PowerShell:  $env:SMOKE_TABLETALK='empty'; node tests/tableTalk.e2e.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const distDir = path.resolve("dist");
const PORT = 1933;
const MODE = ["empty", "error", "fa"].includes(process.env.SMOKE_TABLETALK)
  ? process.env.SMOKE_TABLETALK
  : "json";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const FAKE_FEED = {
  items: [
    {
      id: "tt-1",
      authorName: "سارا محمودی",
      authorNameEn: "Sara M.",
      body: "سرویس سریع و برگر تازه بود.",
      bodyEn: "Fast service and a fresh burger.",
      rating: 5,
      orderVerified: true,
      createdAt: "2026-04-01T10:00:00.000Z",
      productName: "اسموکی اسمش",
    },
    {
      id: "tt-2",
      authorName: "نیما رضایی",
      authorNameEn: "Nima R.",
      body: "متن دوم.",
      bodyEn: "Second story body.",
      rating: null,
      orderVerified: false,
      createdAt: "2026-03-01T10:00:00.000Z",
      productName: null,
    },
  ],
  total: 2,
};

const browser = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && existsSync(candidate));

if (!browser) {
  console.error("no chrome/edge found");
  process.exit(2);
}

/**
 * In `fa` mode the page is loaded in English and the navbar language button is
 * clicked, so the Persian (RTL) render is exercised for real instead of being
 * asserted from the bundle. The snippet polls because React may commit its first
 * render after the `load` event. It is test-only and never shipped.
 */
function withLanguageSwitch(html) {
  return html.replace(
    "</body>",
    `<script>addEventListener("load",()=>{let tries=0;const timer=setInterval(()=>{const button=document.querySelector('button[aria-label^="Switch language"]');if(button){clearInterval(timer);button.click();}else if(++tries>60){clearInterval(timer);}},200);});</script></body>`,
  );
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  const sendJson = (payload, status = 200) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload));
  };

  if (url.pathname === "/api/public/testimonials") {
    if (MODE === "error") {
      sendJson({ message: "boom" }, 500);
      return;
    }
    sendJson(MODE === "empty" ? { items: [], total: 0 } : FAKE_FEED);
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
    response.end(MODE === "fa" && isDocument ? withLanguageSwitch(body.toString("utf8")) : body);
  } catch {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    const html = await readFile(path.join(distDir, "index.html"), "utf8");
    response.end(MODE === "fa" ? withLanguageSwitch(html) : html);
  }
});


await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const chrome = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${path.join(process.env.TEMP ?? ".", "tabletalk-smoke-profile")}`,
  "--virtual-time-budget=15000",
  "--dump-dom",
  `http://127.0.0.1:${PORT}/`,
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

/** The single-file build inlines the locale JSON, so scripts must be dropped. */
const rendered = dom
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "");
const text = rendered.replace(/\u200C/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const JSON_CHECKS = [
  ["section kicker", "Table talk", true],
  ["section title", "Passed around by word of mouth.", true],
  ["subtitle", "Real guest stories", true],
  ["active quote", "Fast service and a fresh burger.", true],
  ["author name", "Sara M.", true],
  ["verified badge", "Verified order", true],
  ["product context", "About اسموکی اسمش", true],
  ["slider counter", "1 / 2", true],
  ["second quote stays hidden", "Second story body.", false],
  ["no error notice", "Guest stories are not available right now.", false],
];

const EMPTY_CHECKS = [
  ["section kicker hidden", "Table talk", false],
  ["section title hidden", "Passed around by word of mouth.", false],
  ["no error notice", "Guest stories are not available right now.", false],
];

const ERROR_CHECKS = [
  ["error notice", "Guest stories are not available right now.", true],
  ["retry button", "Try again", true],
  ["no quote", "Fast service and a fresh burger.", false],
];

/** After clicking the navbar language button the same feed must render in RTL. */
const FA_CHECKS = [
  ["fa kicker", "حرف میزها", true],
  ["fa quote", "سرویس سریع و برگر تازه بود.", true],
  ["fa author", "سارا محمودی", true],
  ["fa verified badge", "خرید تأییدشده", true],
  ["fa counter digits", "۱ / ۲", true],
  ["english quote gone", "Fast service and a fresh burger.", false],
];

const CHECKS = { json: JSON_CHECKS, empty: EMPTY_CHECKS, error: ERROR_CHECKS, fa: FA_CHECKS }[MODE];

/** Attribute-level checks: `aria-label`s disappear when tags are stripped. */
const MARKUP_CHECKS =
  MODE === "json"
    ? [
        ["prev control", 'aria-label="Previous review"', true],
        ["next control", 'aria-label="Next review"', true],
        ["carousel role", 'aria-roledescription="Guest testimonial slider"', true],
        ["stars label", 'aria-label="5 out of 5 stars"', true],
        ["live region", 'aria-live="polite"', true],
      ]
    : MODE === "fa"
      ? [
          ["rtl direction", 'dir="rtl"', true],
          ["fa document language", 'lang="fa"', true],
          ["fa prev control", 'aria-label="نظر قبلی"', true],
          ["fa stars label", 'aria-label="۵ از ۵ ستاره"', true],
        ]
      : [];

let failed = 0;
for (const [name, needle, expected] of CHECKS) {
  const ok = text.includes(needle) === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} [${MODE}] ${name}`);
}
for (const [name, needle, expected] of MARKUP_CHECKS) {
  const ok = rendered.includes(needle) === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} [${MODE}] ${name}`);
}

console.log(`[${MODE}] rendered=${rendered.length} bytes, chrome exit=${exitCode}`);
if (failed) {
  const anchor = text.indexOf("Table talk");
  console.log(text.slice(Math.max(0, anchor - 200), Math.max(0, anchor) + 1600));
  console.log(errors.slice(-1200));
}
process.exit(failed ? 1 : 0);
