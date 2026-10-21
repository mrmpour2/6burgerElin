/**
 * One-off font audit for the customer site.
 *
 * Serves the built single-file app, proxies `/api` to the local backend, and
 * drives a real headless Chrome over CDP so computed styles, actual font faces
 * and network requests can be inspected after hydration. Every scenario runs
 * with reduced motion so nothing is left hidden by the reveal engine.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const distDir = path.join(root, "dist");
const outDir = path.join(root, "tests", ".font-audit");
const API_ORIGIN = "http://127.0.0.1:5000";
const CART_KEY = "شیش برگر الین-cart-v1";
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
if (!browserPath) throw new Error("no Chrome/Edge binary found");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function proxyApi(request, response) {
  const upstream = httpRequest(new URL(request.url ?? "/", API_ORIGIN), {
    method: request.method,
    headers: { ...request.headers, host: new URL(API_ORIGIN).host },
  });
  upstream.setTimeout(5000, () => upstream.destroy());
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

/** Resolves once the browser process is really gone (Windows lockfile release). */
function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => child.once("exit", () => resolve()));
}

function launchBrowser({ width, height, profileDir }) {
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
      "--force-prefers-reduced-motion",
      "--remote-debugging-port=0",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      `--user-data-dir=${profileDir}`,
      `--window-size=${width},${height}`,
      "about:blank",
    ];
    const child = spawn(browserPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killTree(child);
      reject(new Error(`browser did not expose CDP:\n${stderr.slice(0, 800)}`));
    }, 20000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ child, wsUrl: match[1] });
      }
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`browser exited (${code}):\n${stderr.slice(0, 800)}`));
    });
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP socket timeout")), 10000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", (event) => {
      clearTimeout(timer);
      reject(new Error(`CDP socket error: ${event.message ?? "unknown"}`));
    });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return {
    send,
    close() {
      try {
        socket.close();
      } catch {
        // ignore
      }
    },
  };
}

async function createPage(cdp, { width, height, initScript }) {
  const { targetId } = await cdp.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const send = (method, params) => cdp.send(method, params, sessionId);
  const page = {
    targetId,
    async eval(expression) {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (result.exceptionDetails) {
        throw new Error(
          result.exceptionDetails.exception?.description ??
            result.exceptionDetails.text ??
            "page evaluation failed",
        );
      }
      return result.result.value;
    },
    async waitFor(expression, timeout = 20000) {
      const deadline = Date.now() + timeout;
      let lastError = null;
      while (Date.now() < deadline) {
        try {
          if (await page.eval(`Boolean(${expression})`)) return;
        } catch (error) {
          lastError = error;
        }
        await delay(100);
      }
      throw new Error(
        `timed out waiting for ${expression}${lastError ? `: ${lastError.message}` : ""}`,
      );
    },
    async goto(url) {
      const result = await send("Page.navigate", { url });
      if (result.errorText) throw new Error(result.errorText);
      await page.waitFor('document.readyState === "complete"', 20000);
    },
    async screenshot(filePath) {
      const { data } = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
      });
      await writeFile(filePath, Buffer.from(data, "base64"));
    },
    async close() {
      await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    },
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  if (initScript) {
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: initScript,
    });
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  return page;
}

/* -------------------------------- scenarios -------------------------------- */

const scenarios = [
  {
    name: "en-home-desktop",
    url: "/",
    width: 1440,
    height: 1000,
    lang: "en",
    ready:
      'document.querySelector(".section-title") && document.querySelectorAll("h2,h3").length > 2',
    screenshot: "en-home-desktop.png",
  },
  {
    name: "fa-home-desktop",
    url: "/",
    width: 1440,
    height: 1000,
    lang: "fa",
    ready:
      'document.querySelector(".section-title") && document.querySelectorAll("h2,h3").length > 2',
    screenshot: "fa-home-desktop.png",
  },
  {
    name: "en-home-mobile",
    url: "/",
    width: 390,
    height: 844,
    lang: "en",
    ready:
      'document.querySelector(".section-title") && document.querySelectorAll("h2,h3").length > 2',
    screenshot: "en-home-mobile.png",
  },
  {
    name: "fa-home-mobile",
    url: "/",
    width: 390,
    height: 844,
    lang: "fa",
    ready:
      'document.querySelector(".section-title") && document.querySelectorAll("h2,h3").length > 2',
    screenshot: "fa-home-mobile.png",
  },
  {
    name: "en-menu-desktop",
    url: "/menu",
    width: 1440,
    height: 1000,
    lang: "en",
    ready:
      'document.querySelector("h1") && document.querySelectorAll("#menu-panel h3").length > 2',
  },
  {
    name: "fa-menu-desktop",
    url: "/menu",
    width: 1440,
    height: 1000,
    lang: "fa",
    ready:
      'document.querySelector("h1") && document.querySelectorAll("#menu-panel h3").length > 2',
  },
  {
    name: "en-checkout-desktop",
    url: "/checkout",
    width: 1280,
    height: 900,
    lang: "en",
    seeded: true,
    ready: 'document.querySelector("form") && document.body.innerText.includes("Smoky")',
  },
  {
    name: "fa-checkout-desktop",
    url: "/checkout",
    width: 1280,
    height: 900,
    lang: "fa",
    seeded: true,
    ready: 'document.querySelector("form") && document.body.innerText.includes("Smoky")',
  },
];

const seededCart = [
  {
    key: "audit-smoky-smash",
    productId: "audit-smoky-smash",
    id: "audit-smoky-smash",
    name: { en: "Smoky Smash", fa: "اسموکی اسمش" },
    price: 285000,
    image: "/fonts/Vazirmatn-Regular.woff2",
    quantity: 1,
    stock: null,
  },
];

async function setLanguage(page, lang) {
  const current = await page.eval("document.documentElement.lang");
  if (current !== lang) {
    await page.eval(
      'document.querySelector(\'button[aria-label^="Switch language"]\')?.click()',
    );
    await page.waitFor(
      `document.documentElement.lang === ${JSON.stringify(lang)}`,
      10000,
    );
  }
  await page.eval("document.fonts.ready.then(() => true)");
  await delay(600);
}

/* ----------------------------------- main ---------------------------------- */

const server = await startServer();
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
await mkdir(outDir, { recursive: true });
const profilesRoot = await mkdtemp(path.join(tmpdir(), "elin-font-audit-"));
const { child, wsUrl } = await launchBrowser({
  width: 1440,
  height: 1000,
  profileDir: path.join(profilesRoot, "browser"),
});
const cdp = await openCdp(wsUrl);
const results = [];
const issues = [];

try {
  console.log(`[audit] browser ${browserPath}`);
  console.log(`[audit] serving ${path.relative(root, distDir)} at ${origin}`);

  for (const scenario of scenarios) {
    const page = await createPage(cdp, scenario);
    try {
      await page.goto(`${origin}/`);
      if (scenario.seeded) {
        await page.eval(
          `localStorage.setItem(${JSON.stringify(CART_KEY)}, ${JSON.stringify(
            JSON.stringify(seededCart),
          )})`,
        );
        await page.goto(`${origin}${scenario.url}`);
      } else if (scenario.url !== "/") {
        await page.goto(`${origin}${scenario.url}`);
      }
      await page.waitFor(scenario.ready, 30000);
      await setLanguage(page, scenario.lang);
      await page.waitFor(scenario.ready, 30000);
      await delay(800);

      const audit = await page.eval(`(${probe.toString()})()`);
      if (scenario.screenshot) {
        await page.screenshot(path.join(outDir, scenario.screenshot));
      }
      results.push({ scenario, audit });

      const label = `${scenario.name} @${scenario.width}px`;
      const title = audit.titleInfo;
      console.log(`\n[audit] ${label}`);
      console.log(
        `  lang=${audit.lang} dir=${audit.dir} family=${audit.bodyFamily}`,
      );
      console.log(
        `  text=${audit.textCount} controls=${audit.controlCount} families=${audit.allFamilies.join(" | ")}`,
      );
      console.log(
        `  badStyles=${audit.badStyleCount} badFonts=${audit.badFonts.length} remoteFonts=${audit.remoteFonts.length} mono=${audit.monoStyles.length}`,
      );
      console.log(
        `  title=${title ? `${title.tag} ${title.fontSize}px lh=${title.lineHeight} (${title.lineHeightRatio?.toFixed(3)}) ls=${title.letterSpacing} (${title.letterSpacingEm?.toFixed(4)}em)` : "missing"} clone=${audit.cloneInfo?.lineHeight ?? "n/a"}/${audit.cloneInfo?.letterSpacing ?? "n/a"}`,
      );
      console.log(
        `  faces=${audit.faces.map((face) => `${face.family}:${face.weight}:${face.status}`).join(", ") || "none"}`,
      );
      console.log(
        `  fonts=${audit.fontResources.map((url) => url.replace(origin, "")).join(", ") || "none"}`,
      );
      if (audit.badStyles.length) {
        console.log(
          `  bad sample=${JSON.stringify(audit.badStyles.slice(0, 8), null, 2)}`,
        );
      }

      if (audit.lang !== scenario.lang) {
        issues.push(`${label}: lang=${audit.lang}, expected ${scenario.lang}`);
      }
      if (audit.textCount < 20) {
        issues.push(`${label}: only ${audit.textCount} text elements audited`);
      }
      if (audit.badStyleCount !== 0) {
        issues.push(
          `${label}: ${audit.badStyleCount} text/control elements use ${audit.badFamilies.join(", ")}`,
        );
      }
      if (audit.badFonts.length !== 0) {
        issues.push(
          `${label}: non-Vazirmatn @font-face ${JSON.stringify(audit.badFonts)}`,
        );
      }
      if (audit.remoteFonts.length !== 0) {
        issues.push(`${label}: remote fonts ${audit.remoteFonts.join(", ")}`);
      }
      if (
        !audit.fontsCheck.regular ||
        !audit.fontsCheck.bold ||
        !audit.fontsCheck.black
      ) {
        issues.push(
          `${label}: document.fonts.check failed ${JSON.stringify(audit.fontsCheck)}`,
        );
      }
      if (audit.monoStyles.some((entry) => entry.firstFamily !== "vazirmatn")) {
        issues.push(`${label}: font-mono escapes Vazirmatn`);
      }
      const badResource = audit.fontResources.find(
        (url) =>
          !url.startsWith(origin) ||
          !/\/fonts\/Vazirmatn-(Regular|Medium|SemiBold|Bold)\.woff2(\?|$)/.test(
            url,
          ),
      );
      if (badResource) {
        issues.push(`${label}: unexpected font request ${badResource}`);
      }
      if (
        scenario.width < 600 &&
        (audit.layout.scrollWidth > audit.layout.viewport.width + 1 ||
          audit.layout.bodyScrollWidth > audit.layout.viewport.width + 1)
      ) {
        issues.push(
          `${label}: horizontal overflow ${audit.layout.scrollWidth}/${audit.layout.bodyScrollWidth} > ${audit.layout.viewport.width}`,
        );
      }
      if (title && title.firstFamily !== "vazirmatn") {
        issues.push(`${label}: heading family is ${title.family}`);
      }
      if (
        audit.cloneInfo &&
        title &&
        (Math.abs(
          (title.lineHeightRatio ?? 0) - (audit.cloneInfo.lineHeightRatio ?? 0),
        ) > 0.01 ||
          Math.abs(
            (title.letterSpacingEm ?? 0) -
              (audit.cloneInfo.letterSpacingEm ?? 0),
          ) > 0.001)
      ) {
        issues.push(
          `${label}: live title differs from fresh clone (${title.lineHeight}/${audit.cloneInfo.lineHeight}, ${title.letterSpacing}/${audit.cloneInfo.letterSpacing})`,
        );
      }
      if (scenario.url === "/") {
        if (!audit.sectionTitles.length) {
          issues.push(`${label}: no .section-title rendered`);
        }
        const expected =
          scenario.lang === "fa"
            ? { lineHeight: 1.18, letterSpacing: -0.025 }
            : { lineHeight: 0.96, letterSpacing: -0.055 };
        for (const sectionTitle of audit.sectionTitles) {
          if (
            Math.abs((sectionTitle.lineHeightRatio ?? 0) - expected.lineHeight) >
              0.02 ||
            Math.abs(
              (sectionTitle.letterSpacingEm ?? 0) - expected.letterSpacing,
            ) > 0.004
          ) {
            issues.push(
              `${label}: .section-title "${sectionTitle.text.slice(0, 24)}" lh=${sectionTitle.lineHeightRatio?.toFixed(3)} ls=${sectionTitle.letterSpacingEm?.toFixed(4)}em, expected ${expected.lineHeight}/${expected.letterSpacing}`,
            );
          }
        }
      }
    } finally {
      await page.close();
    }
  }
} finally {
  server.close();
  cdp.close();
  killTree(child);
  await Promise.race([waitForExit(child), delay(5000)]);
  await rm(profilesRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 300,
  }).catch(() => {});
}

await writeFile(
  path.join(root, "tests", "font-audit.tmp.json"),
  JSON.stringify(
    results.map(({ scenario, audit }) => ({ name: scenario.name, audit })),
    null,
    2,
  ),
);

if (issues.length) {
  console.error(`\n[audit] ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`  x ${issue}`);
  process.exit(1);
}
console.log(
  `\n[audit] PASS — ${results.length} scenarios, zero bad styles, zero non-Vazirmatn faces, zero remote fonts`,
);

/* -------------------------------- page probe -------------------------------- */

function probe() {
  const normalize = (value) =>
    String(value).trim().replace(/^["']|["']$/g, "").toLowerCase();
  const firstFamily = (value) => normalize(String(value).split(",")[0]);
  const px = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const visible = (element) => {
    if (element.matches("script,style,noscript,template")) return false;
    if (!element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return Number(style.opacity) !== 0;
  };
  const hasDirectText = (element) =>
    [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );
  const describe = (element) => {
    const style = getComputedStyle(element);
    const fontSize = px(style.fontSize);
    return {
      tag: element.tagName.toLowerCase(),
      className:
        typeof element.className === "string"
          ? element.className.slice(0, 160)
          : "",
      text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
      family: style.fontFamily,
      firstFamily: firstFamily(style.fontFamily),
      fontSize,
      lineHeight: style.lineHeight,
      lineHeightRatio:
        fontSize && px(style.lineHeight) !== null
          ? px(style.lineHeight) / fontSize
          : null,
      letterSpacing: style.letterSpacing,
      letterSpacingEm:
        fontSize && px(style.letterSpacing) !== null
          ? px(style.letterSpacing) / fontSize
          : null,
      weight: style.fontWeight,
    };
  };
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  };

  const textElements = [...document.querySelectorAll("body *")].filter(
    (element) => hasDirectText(element) && visible(element),
  );
  const controlElements = [
    ...document.querySelectorAll("input,textarea,select"),
  ].filter(visible);
  const textStyles = textElements.map(describe);
  const controlStyles = controlElements.map(describe);
  const allStyles = [...textStyles, ...controlStyles];
  const badStyles = allStyles.filter(
    (entry) => entry.firstFamily !== "vazirmatn",
  );
  const badFamilies = [...new Set(badStyles.map((entry) => entry.firstFamily))];

  const bodyStyle = getComputedStyle(document.body);
  const title = document.querySelector(".section-title");
  const heading = title ?? document.querySelector("h1");
  const titleInfo = heading ? describe(heading) : null;
  let cloneInfo = null;
  if (heading?.parentElement) {
    const clone = heading.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("data-font-audit-clone", "");
    clone.style.position = "static";
    clone.style.visibility = "visible";
    clone.style.opacity = "1";
    heading.parentElement.appendChild(clone);
    cloneInfo = describe(clone);
    clone.remove();
  }
  const sectionTitles = [...document.querySelectorAll(".section-title")].map(
    describe,
  );

  const faces = [...document.fonts].map((face) => ({
    family: face.family,
    weight: face.weight,
    style: face.style,
    status: face.status,
  }));
  const badFonts = faces.filter(
    (face) => normalize(face.family) !== "vazirmatn",
  );
  const fontResources = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter(
      (url) =>
        /\.(woff2?|ttf|otf)(\?|$)/i.test(url) ||
        /fonts\.(googleapis|gstatic)\.com/i.test(url),
    );
  const remoteFonts = fontResources.filter(
    (url) =>
      !url.startsWith(location.origin) ||
      /fonts\.(googleapis|gstatic)\.com/i.test(url),
  );

  return {
    url: location.href,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    bodyFamily: bodyStyle.fontFamily,
    allFamilies: [...new Set(allStyles.map((entry) => entry.firstFamily))],
    textCount: textStyles.length,
    controlCount: controlStyles.length,
    badStyles: badStyles.slice(0, 40),
    badStyleCount: badStyles.length,
    badFamilies,
    monoStyles: textStyles.filter((entry) =>
      entry.className.split(/\s+/).includes("font-mono"),
    ),
    titleInfo,
    cloneInfo,
    sectionTitles,
    faces,
    badFonts,
    fontResources,
    remoteFonts,
    fontsCheck: {
      regular: document.fonts.check("400 16px Vazirmatn"),
      bold: document.fonts.check("700 16px Vazirmatn"),
      black: document.fonts.check("900 16px Vazirmatn"),
    },
    layout: {
      header: rect(document.querySelector("header")),
      hero: rect(document.querySelector("[data-hero]")),
      firstSection: rect(document.querySelector("main section")),
      footer: rect(document.querySelector("footer")),
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    },
  };
}
