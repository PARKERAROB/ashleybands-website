// Local visual preview (#96): npm run preview:shots -- / /support-carnegie
// Starts the guarded dev server on a free port, captures phone and desktop screenshots, and
// reports overflow, console errors, failed requests and every write it blocked.
// Writes are blocked twice: the browser aborts non-GET requests, and the server guard refuses
// them. The run refuses to start if the server guard cannot be confirmed.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { OVERRIDE_ENV, PROBE_PATH, outboundDecision, writesAllowed } from "./lib/local-write-guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
};
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const HIDE_DEV_OVERLAY = "nextjs-portal { display: none !important; }";

export function parseArgs(argv) {
  const opts = { routes: [], viewports: Object.keys(VIEWPORTS), out: null, baseUrl: null, timeout: 180000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") opts.out = argv[++i];
    else if (arg === "--base-url") opts.baseUrl = argv[++i];
    else if (arg === "--viewports") opts.viewports = argv[++i].split(",").map((v) => v.trim()).filter(Boolean);
    else if (arg === "--timeout") opts.timeout = Number(argv[++i]) * 1000;
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else opts.routes.push(arg.startsWith("/") ? arg : `/${arg}`);
  }
  if (!opts.routes.length) opts.routes.push("/");
  for (const name of opts.viewports) if (!VIEWPORTS[name]) throw new Error(`Unknown viewport ${name}`);
  if (opts.baseUrl && !LOOPBACK.has(new URL(opts.baseUrl).host.replace(/:\d+$/, ""))) {
    throw new Error("--base-url must be a local dev server (localhost, 127.0.0.1 or [::1])");
  }
  return opts;
}

export function slugFor(route) {
  const slug = route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9-]+/g, "_");
  return slug || "home";
}

// Browser layer: only GET and HEAD leave the page, to any origin.
export function browserDecision(method, url) {
  return outboundDecision({ method, url });
}

// Aborts every non-GET/HEAD request the context makes, including cross-origin ones.
export async function guardBrowserContext(context, onBlocked) {
  await context.route("**/*", (routeRequest) => {
    const request = routeRequest.request();
    if (browserDecision(request.method(), request.url()).allow) return routeRequest.continue();
    onBlocked({ method: request.method(), url: withoutQuery(request.url()) });
    return routeRequest.abort("blockedbyclient");
  });
}

function withoutQuery(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "localhost", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

async function readGuard(base) {
  const response = await fetch(base + PROBE_PATH, { signal: AbortSignal.timeout(5000) });
  if (response.status !== 200) return null;
  const status = await response.json();
  return status.inbound === true && status.outbound === true ? status : null;
}

async function startServer(timeout) {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const env = { ...process.env };
  delete env[OVERRIDE_ENV];
  const child = spawn(process.execPath, [join(root, "scripts/local-dev-server.mjs"), "--port", String(port)], {
    cwd: root,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Already exited.
    }
  };
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      if (await readGuard(base)) return { base, stop, log: () => log };
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  throw new Error(`Dev server did not confirm the write guard.\n${log.slice(-3000)}`);
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  // Walk the page once so lazy images and in-view effects render in the full-page capture.
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
  });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
}

function measureOverflow() {
  const width = document.documentElement.clientWidth;
  const scrollWidth = document.documentElement.scrollWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      if (["hidden", "auto", "scroll", "clip"].includes(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const describe = (el) => {
    let label = el.tagName.toLowerCase();
    if (el.id) label += `#${el.id}`;
    const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
    if (classes.length) label += `.${classes.join(".")}`;
    return label;
  };
  const offenders = [];
  for (const el of document.body.querySelectorAll("*")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right > width + 1 && !clipped(el)) {
      offenders.push({ element: describe(el), right: Math.round(rect.right) });
      if (offenders.length >= 8) break;
    }
  }
  return { viewportWidth: width, scrollWidth, overflowPx: Math.max(0, scrollWidth - width), offenders };
}

async function capture(browser, base, route, name, outDir, timeout) {
  const context = await browser.newContext({ ...VIEWPORTS[name], serviceWorkers: "block", reducedMotion: "reduce" });
  const page = await context.newPage();
  const result = {
    route, viewport: name, width: VIEWPORTS[name].viewport.width,
    status: null, error: null, consoleErrors: [], pageErrors: [], failedRequests: [], blockedWrites: [], overflow: null, screenshot: null,
  };
  await guardBrowserContext(context, (blocked) => result.blockedWrites.push(blocked));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Chromium echoes each failed subresource as a console error; failedRequests carries the URL.
    if (!text.startsWith("Failed to load resource")) result.consoleErrors.push(text.slice(0, 500));
  });
  page.on("pageerror", (error) => result.pageErrors.push(String(error?.message || error).slice(0, 500)));
  const noteFailure = (entry) => {
    const key = `${entry.method} ${entry.url} ${entry.status ?? entry.error}`;
    if (!result.failedRequests.some((f) => `${f.method} ${f.url} ${f.status ?? f.error}` === key)) result.failedRequests.push(entry);
  };
  page.on("requestfailed", (request) => {
    // Our own aborts are listed as blockedWrites; ERR_ABORTED is the page cancelling a request.
    if (["net::ERR_BLOCKED_BY_CLIENT", "net::ERR_ABORTED"].includes(request.failure()?.errorText)) return;
    noteFailure({ method: request.method(), url: withoutQuery(request.url()), error: request.failure()?.errorText });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      noteFailure({ method: response.request().method(), url: withoutQuery(response.url()), status: response.status() });
    }
  });
  try {
    const response = await page.goto(base + route, { waitUntil: "load", timeout });
    result.status = response?.status() ?? null;
    await settle(page);
    await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
    result.overflow = await page.evaluate(measureOverflow);
    const file = join(outDir, `${slugFor(route)}--${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    result.screenshot = file;
  } catch (error) {
    result.error = String(error?.message || error).split("\n")[0];
  } finally {
    await context.close();
  }
  return result;
}

export function problemsFor(result) {
  const problems = [];
  if (result.error) problems.push(`navigation failed: ${result.error}`);
  if (result.status !== null && result.status >= 400) problems.push(`HTTP ${result.status}`);
  if (result.overflow?.overflowPx > 0) problems.push(`horizontal overflow ${result.overflow.overflowPx}px`);
  if (result.pageErrors.length) problems.push(`${result.pageErrors.length} uncaught page error(s)`);
  if (result.consoleErrors.length) problems.push(`${result.consoleErrors.length} console error(s)`);
  return problems;
}

function printResult(result) {
  const problems = problemsFor(result);
  const mark = problems.length ? "✗" : "✓";
  console.log(`${mark} ${result.route}  ${result.viewport} ${result.width}px  HTTP ${result.status ?? "-"}`);
  for (const problem of problems) console.log(`    ${problem}`);
  for (const o of result.overflow?.offenders ?? []) console.log(`      wide: ${o.element} (right edge ${o.right}px)`);
  for (const e of [...result.pageErrors, ...result.consoleErrors].slice(0, 5)) console.log(`      error: ${e.split("\n")[0]}`);
  for (const f of result.failedRequests) console.log(`    note: ${f.method} ${f.url} -> ${f.status ?? f.error}`);
  for (const b of result.blockedWrites) console.log(`    blocked in browser: ${b.method} ${b.url}`);
  for (const b of result.serverBlocked ?? []) console.log(`    blocked by server: ${b.method} ${b.target ?? b.path}`);
  if (result.screenshot) {
    const shown = relative(process.cwd(), result.screenshot);
    console.log(`    ${shown.startsWith("..") ? result.screenshot : shown}`);
  }
}

async function main() {
  if (writesAllowed(process.env)) {
    throw new Error(`preview:shots never runs with ${OVERRIDE_ENV}=1. Unset it and retry.`);
  }
  const opts = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = resolve(opts.out ?? join(root, ".preview-shots", stamp));
  await mkdir(outDir, { recursive: true });

  let server = null;
  let base = opts.baseUrl?.replace(/\/$/, "");
  if (base) {
    if (!(await readGuard(base).catch(() => null))) {
      throw new Error(`${base} does not report an active write guard. Start it with npm run dev (without ${OVERRIDE_ENV}).`);
    }
  } else {
    console.log("Starting the guarded dev server...");
    server = await startServer(opts.timeout);
    base = server.base;
  }
  console.log(`Write guard confirmed at ${base}${PROBE_PATH}\n`);

  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ headless: true }).catch((error) => {
      throw new Error(`${error.message.split("\n")[0]}\nInstall the browser once with: npx playwright install chromium-headless-shell`);
    });
    for (const route of opts.routes) {
      for (const name of opts.viewports) {
        const before = await readGuard(base);
        const result = await capture(browser, base, route, name, outDir, opts.timeout);
        const after = await readGuard(base);
        const lastSeen = Math.max(0, ...[...before.outboundBlocked, ...before.inboundBlocked].map((b) => b.seq));
        result.serverBlocked = [...after.outboundBlocked, ...after.inboundBlocked].filter((b) => b.seq > lastSeen);
        results.push(result);
        printResult(result);
      }
    }
  } finally {
    await browser?.close();
    server?.stop();
  }

  const failing = results.filter((r) => problemsFor(r).length);
  await writeFile(join(outDir, "report.json"), JSON.stringify({ base, results }, null, 2));
  console.log(`\nScreenshots and report.json: ${outDir}`);
  console.log(failing.length ? `${failing.length} capture(s) need attention.` : "No overflow or errors found.");
  process.exitCode = failing.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
