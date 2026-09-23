// Local write guard proofs (#96). Synthetic only: the integration case points the real guarded
// dev server at an isolated loopback backend and never reaches production.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import {
  GUARD_HEADER,
  PROBE_PATH,
  createGuardState,
  createGuardedHandler,
  guardFetch,
  guardRequestModule,
  inboundDecision,
  outboundDecision,
  writesAllowed,
} from "./lib/local-write-guard.mjs";
import { chromium } from "playwright";
import { browserDecision, guardBrowserContext, parseArgs, problemsFor, slugFor } from "./preview-shots.mjs";

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const GIFT_ROUTES = ["/api/sponsors/give/check", "/api/sponsors/give/create-order"];

test("inbound guard refuses every write method, including server actions", () => {
  for (const method of WRITE_METHODS) {
    for (const url of [...GIFT_ROUTES, "/api/newsletter/subscribe", "/", "/support-carnegie?x=1"]) {
      assert.equal(inboundDecision({ method, url }).allow, false, `${method} ${url}`);
    }
  }
  assert.equal(inboundDecision({ method: "post", url: "/api/confirm" }).allow, false);
  assert.equal(inboundDecision({ method: "POST", url: "/__nextjs_x/../api/sponsors/give/check" }).allow, false);
  assert.equal(inboundDecision({ method: "POST", url: "/_next/../api/sponsors/give/check" }).allow, false);
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(inboundDecision({ method, url: "/api/carnegie-2027/funding" }).allow, true);
  }
  assert.equal(inboundDecision({ method: "POST", url: "/__nextjs_original-stack-frames" }).allow, true);
});

test("outbound and browser guards let only GET and HEAD leave", () => {
  const targets = [
    "https://example.supabase.co/rest/v1/sponsor_gifts",
    "https://api-m.paypal.com/v2/checkout/orders",
    "https://api.resend.com/emails",
    "http://127.0.0.1:54321/rest/v1/businesses",
  ];
  for (const url of targets) {
    for (const method of [...WRITE_METHODS, "OPTIONS"]) {
      assert.equal(outboundDecision({ method, url }).allow, false, `${method} ${url}`);
      assert.equal(browserDecision(method, url).allow, false, `browser ${method} ${url}`);
    }
    assert.equal(outboundDecision({ method: "GET", url }).allow, true);
    assert.equal(browserDecision("HEAD", url).allow, true);
  }
  assert.equal(browserDecision("POST", "http://localhost:3000/api/sponsors/give/check").allow, false);
});

test("only ALLOW_LOCAL_WRITES=1 disables the guard", () => {
  assert.equal(writesAllowed({}), false);
  for (const value of ["true", "yes", "0", "", " 1"]) assert.equal(writesAllowed({ ALLOW_LOCAL_WRITES: value }), false, value);
  assert.equal(writesAllowed({ ALLOW_LOCAL_WRITES: "1" }), true);
});

test("guarded fetch refuses writes before the network is touched", async () => {
  const calls = [];
  const state = createGuardState();
  const fetch = guardFetch(async (input, init) => {
    calls.push([input, init]);
    return new Response("ok");
  }, state);
  const supabase = "https://example.supabase.co/rest/v1/sponsor_gifts";
  await assert.rejects(fetch(supabase, { method: "POST", body: "{}" }), /local write guard/);
  await assert.rejects(fetch(new Request(supabase, { method: "PATCH", body: "{}" })), /local write guard/);
  await assert.rejects(fetch(new URL(supabase), { method: "delete" }), /local write guard/);
  assert.equal(calls.length, 0);
  await fetch(supabase);
  assert.equal(calls.length, 1);
  assert.deepEqual(state.outboundBlocked.map((b) => b.method), ["POST", "PATCH", "DELETE"]);
  assert.equal(state.outboundChecked, 4);
  assert.equal(guardFetch(fetch, state), fetch, "installing twice keeps one wrapper");
});

test("guarded http.request refuses writes in every call form", () => {
  const calls = [];
  const mod = { request: (...args) => calls.push(args) };
  const state = createGuardState();
  guardRequestModule(mod, "https:", state);
  assert.throws(() => mod.request({ hostname: "api.resend.com", path: "/emails", method: "POST" }), /local write guard/);
  assert.throws(() => mod.request("https://api-m.paypal.com/v1/oauth2/token", { method: "POST" }, () => {}), /local write guard/);
  assert.equal(calls.length, 0);
  mod.request("https://example.com/", () => {});
  mod.request({ hostname: "example.com", path: "/" });
  assert.equal(calls.length, 2);
  assert.equal(state.outboundBlocked[0].target, "https://api.resend.com/emails");
});

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

test("guarded handler answers gift writes itself; Next never sees them", async () => {
  const handled = [];
  const state = createGuardState();
  const server = createServer(createGuardedHandler((req, res) => {
    handled.push(`${req.method} ${req.url}`);
    res.end("next");
  }, state));
  const base = await listen(server);
  try {
    for (const path of GIFT_ROUTES) {
      const response = await fetch(base + path, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      assert.equal(response.status, 403);
      assert.equal(response.headers.get(GUARD_HEADER.toLowerCase()), "blocked");
      assert.match((await response.json()).error, /ALLOW_LOCAL_WRITES=1/);
    }
    assert.equal((await fetch(base + "/", { method: "POST", headers: { "Next-Action": "abc" } })).status, 403);
    assert.equal(handled.length, 0);
    assert.equal(await (await fetch(base + "/support-carnegie")).text(), "next");
    const probe = await (await fetch(base + PROBE_PATH)).json();
    assert.equal(probe.inbound, true);
    assert.deepEqual(probe.inboundBlocked.map((b) => b.path), [...GIFT_ROUTES, "/"]);
  } finally {
    server.close();
  }
});

test("preview arguments stay local and name files predictably", () => {
  assert.deepEqual(parseArgs([]).routes, ["/"]);
  assert.deepEqual(parseArgs(["support-carnegie", "/"]).routes, ["/support-carnegie", "/"]);
  assert.throws(() => parseArgs(["--base-url", "https://ashleybands.com"]), /local dev server/);
  assert.throws(() => parseArgs(["--viewports", "tablet"]), /Unknown viewport/);
  assert.equal(parseArgs(["--base-url", "http://localhost:3000"]).baseUrl, "http://localhost:3000");
  assert.equal(slugFor("/"), "home");
  assert.equal(slugFor("/sponsors/give?x=1"), "sponsors_give_x_1");
  const clean = { error: null, status: 200, overflow: { overflowPx: 0 }, pageErrors: [], consoleErrors: [] };
  assert.deepEqual(problemsFor(clean), []);
  assert.equal(problemsFor({ ...clean, overflow: { overflowPx: 12 } }).length, 1);
});

test("real guarded dev server blocks inbound gift writes and outbound writes from a GET route", { timeout: 240000 }, async () => {
  // Isolated synthetic Supabase. Any non-GET request reaching it is a guard failure.
  const received = [];
  const backend = createServer((req, res) => {
    received.push(`${req.method} ${new URL(req.url, "http://x").pathname}`);
    res.writeHead(200, { "Content-Type": "application/json" });
    const expiredClaim = req.method === "GET" && req.url.startsWith("/rest/v1/businesses");
    res.end(JSON.stringify(expiredClaim ? [{ id: "synthetic-business", claimed_by_family_id: "synthetic-family" }] : []));
  });
  const backendBase = await listen(backend);
  const port = 4300 + Math.floor(Math.random() * 500);
  const base = `http://localhost:${port}`;
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: backendBase,
    SUPABASE_SECRET_KEY: "synthetic-service-key",
    SPONSOR_FUNNEL_LIVE: "true",
    SPONSOR_RECOGNITION_LIVE: "false",
    NEXT_PUBLIC_SITE_ORIGIN: base,
  };
  delete env.ALLOW_LOCAL_WRITES;
  delete env.CRON_SECRET;
  const child = spawn(process.execPath, ["scripts/local-dev-server.mjs", "--port", String(port)], {
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  try {
    let probe = null;
    for (let i = 0; i < 120 && !probe; i++) {
      probe = await fetch(base + PROBE_PATH).then((r) => r.json()).catch(() => null);
      if (!probe) await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(probe, `dev server did not start:\n${log.slice(-2000)}`);
    assert.equal(probe.inbound, true);
    assert.equal(probe.outbound, true);

    for (const path of GIFT_ROUTES) {
      const response = await fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify({ amount: 25, campaign: "carnegie-2027" }),
      });
      assert.equal(response.status, 403, path);
      assert.equal(response.headers.get("x-local-write-guard"), "blocked");
    }
    assert.deepEqual(received, [], "gift POSTs never reached route code");

    // This GET route releases expired claims when CRON_SECRET is unset, as in local dev.
    const sweep = await fetch(base + "/api/sponsors/reclaim-sweep");
    assert.equal(sweep.status, 200, log.slice(-2000));
    assert.ok(received.includes("GET /rest/v1/businesses"), "route code ran against the synthetic backend");
    assert.deepEqual(received.filter((r) => !r.startsWith("GET ")), [], "no write reached the backend");
    const after = await (await fetch(base + PROBE_PATH)).json();
    const blocked = after.outboundBlocked.map((b) => `${b.method} ${new URL(b.target).pathname}`);
    assert.ok(blocked.includes("PATCH /rest/v1/businesses"), blocked.join(", "));
    assert.ok(blocked.includes("DELETE /rest/v1/prospects"), blocked.join(", "));

    // Browser layer: the page's own POSTs are aborted before they reach the server.
    if (!existsSync(chromium.executablePath())) {
      console.log("# Chromium not installed; skipping the browser-layer check");
      return;
    }
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ serviceWorkers: "block" });
      const aborted = [];
      await guardBrowserContext(context, (b) => aborted.push(`${b.method} ${b.url}`));
      const page = await context.newPage();
      await page.goto(base + PROBE_PATH);
      const outcomes = await page.evaluate(async (targets) => Promise.all(targets.map((url) =>
        fetch(url, { method: "POST", body: "{}", mode: "no-cors" }).then((r) => `reached ${r.status}`, () => "aborted"))),
      [base + GIFT_ROUTES[0], base + GIFT_ROUTES[1], "https://api-m.paypal.com/v2/checkout/orders"]);
      assert.deepEqual(outcomes, ["aborted", "aborted", "aborted"]);
      assert.equal(aborted.length, 3);
      const inbound = (await (await fetch(base + PROBE_PATH)).json()).inboundBlocked.length;
      assert.equal(inbound, GIFT_ROUTES.length, "browser POSTs never reached the server");
      assert.deepEqual(received.filter((r) => !r.startsWith("GET ")), []);
    } finally {
      await browser.close();
    }
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Already exited.
    }
    backend.close();
  }
});
