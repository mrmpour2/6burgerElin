/**
 * End-to-end smoke check for the product reviews section.
 *
 *   npm run test:reviews:e2e      # build, then check the demo fallback
 *   node tests/reviews.e2e.mjs    # check an existing dist/
 *
 * `dist/` is served together with a fake `/api/public/menu` (the curated
 * `smoky-smash` catalog entry is commented out, so the product route depends on
 * the live menu). `/menu/smoky-smash` is then rendered in headless Chrome and
 * the *rendered* DOM is asserted — the single-file build inlines the locale
 * JSON, so `<script>` bodies are stripped first and every needle is compared
 * against real markup.
 *
 * Two modes, because the reviews API does not exist yet:
 *
 *   (default)            `/api/public/reviews` falls through to `index.html`,
 *                        exactly like a static host → demo data + banner
 *   SMOKE_REVIEWS=json   a real JSON page is served → API data, no banner
 *
 * PowerShell:  $env:SMOKE_REVIEWS='json'; node tests/reviews.e2e.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const distDir = path.resolve("dist");
const PORT = 1932;
const MODE = process.env.SMOKE_REVIEWS === "json" ? "json" : "missing";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

const FAKE_MENU = {
  items: [
    {
      id: "ckx_product_1",
      slug: "smoky-smash",
      productId: "ckx_product_1",
      name: "اسموکی اسمش",
      description: "برگر دودی با سس مخصوص",
      category: "burgers",
      categoryLabel: "برگر",
      price: 320000,
      currency: "IRR",
      image: null,
      stock: 12,
      available: true,
      variants: [],
    },
  ],
  total: 1,
  currency: "IRR",
};

const FAKE_REVIEWS = {
  items: [
    {
      id: "api-1",
      productId: "ckx_product_1",
      authorName: "API Tester",
      rating: 5,
      body: "This body came from the reviews API.",
      createdAt: "2026-04-01T10:00:00.000Z",
      images: [],
      orderVerified: true,
      status: "PUBLISHED",
      reply: { body: "Glad you liked it.", createdAt: "2026-04-02T10:00:00.000Z" },
    },
    {
      id: "api-2",
      productId: "ckx_product_1",
      authorName: "Second Tester",
      rating: 4,
      body: "Second API review body.",
      createdAt: "2026-03-01T10:00:00.000Z",
      images: [],
      orderVerified: false,
      status: "PUBLISHED",
      reply: null,
    },
  ],
  summary: { average: 4.6, total: 12, distribution: { 1: 1, 2: 1, 3: 1, 4: 4, 5: 5 } },
  total: 12,
  page: 1,
  hasMore: false,
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  const sendJson = (payload) => {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload));
  };

  if (url.pathname === "/api/public/menu") {
    sendJson(FAKE_MENU);
    return;
  }
  if (url.pathname === "/api/public/reviews" && MODE === "json") {
    sendJson(FAKE_REVIEWS);
    return;
  }

  const filePath = path.join(distDir, url.pathname === "/" ? "/index.html" : url.pathname);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream",
    });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(await readFile(path.join(distDir, "index.html")));
  }
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const chrome = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${path.join(process.env.TEMP ?? ".", "reviews-smoke-profile")}`,
  "--virtual-time-budget=15000",
  "--dump-dom",
  `http://127.0.0.1:${PORT}/menu/smoky-smash`,
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

const DEMO = [
  ["section kicker", "Guest reviews", true],
  ["section title", "What guests are saying", true],
  ["demo banner", "The reviews backend is not enabled", true],
  ["summary card", "Average rating", true],
  ["summary count", "Based on 8 reviews", true],
  ["distribution row", "5 star", true],
  ["demo review body", "Arrived hot and juicy", true],
  ["restaurant reply", "Elin Burger reply", true],
  ["verified badge", "Verified order", true],
  ["filters", "Filter reviews", true],
  ["sort control", "Newest", true],
  ["form title", "Tell us how it was", true],
  ["form rating label", "Your rating", true],
  ["form phone label", "Phone number (optional)", true],
  ["form submit", "Submit review", true],
  ["load more", "Load more reviews", true],
  ["no error card", "Reviews could not load", false],
  ["no empty state", "No reviews match these filters", false],
];

const API = [
  ["api review body", "This body came from the reviews API.", true],
  ["second api review", "Second API review body.", true],
  ["api summary count", "Based on 12 reviews", true],
  ["api average", "4.6", true],
  ["api reply", "Elin Burger reply", true],
  ["verified badge", "Verified order", true],
  ["no demo banner", "The reviews backend is not enabled", false],
  ["no load more", "Load more reviews", false],
  ["no error card", "Reviews could not load", false],
];

let failed = 0;
for (const [name, needle, expected] of MODE === "json" ? API : DEMO) {
  const ok = text.includes(needle) === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "FAIL"} [${MODE}] ${name}`);
}

console.log(`[${MODE}] rendered=${rendered.length} bytes, chrome exit=${exitCode}`);
if (failed) {
  const anchor = text.indexOf("Guest reviews");
  console.log(text.slice(Math.max(0, anchor - 120), Math.max(0, anchor) + 1800));
  console.log(errors.slice(-1200));
}
process.exit(failed ? 1 : 0);
