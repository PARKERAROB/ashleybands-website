// Local write guard for the dev server and preview tooling (#96).
// Local dev uses production credentials from .env.local, so every layer here fails closed:
// inbound requests that can change state are refused, and outbound calls that can change
// state never leave the process. Only ALLOW_LOCAL_WRITES=1 in the launching shell disables it.

export const OVERRIDE_ENV = "ALLOW_LOCAL_WRITES";
export const PROBE_PATH = "/__local-write-guard";
export const GUARD_HEADER = "X-Local-Write-Guard";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Next dev overlay endpoints (stack frames, devtools config). They stay inside the dev process;
// any outbound call they made would still meet the outbound guard.
const DEV_TOOLING_PREFIX = "/__nextjs_";
const GUARDED = Symbol.for("ashleybands.localWriteGuard");

export function writesAllowed(env = process.env) {
  return env[OVERRIDE_ENV] === "1";
}

function pathOf(url) {
  try {
    return new URL(url, "http://local.invalid").pathname;
  } catch {
    return null;
  }
}

export function inboundDecision({ method, url }) {
  const verb = String(method || "GET").toUpperCase();
  if (READ_METHODS.has(verb)) return { allow: true };
  const path = pathOf(url);
  if (path && path.startsWith(DEV_TOOLING_PREFIX)) return { allow: true };
  return { allow: false, reason: `${verb} ${path ?? "(unparseable URL)"} refused by the local write guard` };
}

export function outboundDecision({ method, url }) {
  const verb = String(method || "GET").toUpperCase();
  if (verb === "GET" || verb === "HEAD") return { allow: true };
  let target = "(unparseable URL)";
  try {
    const u = new URL(url);
    target = `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    // Fall through with the placeholder; the call is refused either way.
  }
  return { allow: false, target, reason: `${verb} ${target} blocked by the local write guard` };
}

export function createGuardState() {
  return { outboundChecked: 0, outboundBlocked: [], inboundBlocked: [], seq: 0 };
}

function remember(state, list, entry) {
  state.seq += 1;
  list.push({ ...entry, seq: state.seq, at: new Date().toISOString() });
  if (list.length > 200) list.shift();
}

function refusal(reason) {
  return `${reason}. Local dev does not write to production services. Restart with ${OVERRIDE_ENV}=1 only when a write is intended.`;
}

function fetchTarget(input, init) {
  if (typeof input === "string" || input instanceof URL) {
    return { url: String(input), method: init?.method || "GET" };
  }
  return { url: input?.url, method: init?.method || input?.method || "GET" };
}

export function guardFetch(baseFetch, state) {
  if (baseFetch[GUARDED]) return baseFetch;
  const guarded = async function guardedFetch(input, init) {
    const target = fetchTarget(input, init);
    state.outboundChecked += 1;
    const decision = outboundDecision(target);
    if (!decision.allow) {
      remember(state, state.outboundBlocked, { method: String(target.method).toUpperCase(), target: decision.target });
      console.warn(`[local-write-guard] ${decision.reason}`);
      throw new TypeError(refusal(decision.reason));
    }
    return baseFetch(input, init);
  };
  guarded[GUARDED] = true;
  return guarded;
}

function requestTarget(args, defaultProtocol) {
  let url;
  let options = {};
  for (const arg of args) {
    if (typeof arg === "string" || arg instanceof URL) url = new URL(String(arg));
    else if (arg && typeof arg === "object" && typeof arg !== "function") options = arg;
  }
  const method = options.method || "GET";
  if (url) return { method, url: url.href };
  const host = options.hostname || options.host || "localhost";
  const port = options.port ? `:${options.port}` : "";
  return { method, url: `${options.protocol || defaultProtocol}//${host}${port}${options.path || "/"}` };
}

// Guards http/https.request for libraries that bypass fetch. .get always issues GET.
export function guardRequestModule(mod, protocol, state) {
  if (mod.request[GUARDED]) return;
  const original = mod.request;
  const guarded = function guardedRequest(...args) {
    const target = requestTarget(args, protocol);
    state.outboundChecked += 1;
    const decision = outboundDecision(target);
    if (!decision.allow) {
      remember(state, state.outboundBlocked, { method: String(target.method).toUpperCase(), target: decision.target });
      console.warn(`[local-write-guard] ${decision.reason}`);
      throw new Error(refusal(decision.reason));
    }
    return original.apply(this, args);
  };
  guarded[GUARDED] = true;
  mod.request = guarded;
}

export function isFetchGuarded(fn) {
  return Boolean(fn?.[GUARDED]);
}

// Must run before Next loads so its patched fetch wraps the guarded one.
export function installOutboundGuard(state, { http, https }) {
  globalThis.fetch = guardFetch(globalThis.fetch, state);
  guardRequestModule(http, "http:", state);
  guardRequestModule(https, "https:", state);
  state.outboundInstalled = true;
}

// Wraps a Node request handler. Refused requests never reach Next.
export function createGuardedHandler(handle, state) {
  return function guardedHandler(req, res) {
    if (pathOf(req.url) === PROBE_PATH) {
      res.writeHead(req.method === "GET" ? 200 : 403, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        [GUARD_HEADER]: "active",
      });
      return res.end(JSON.stringify({
        inbound: true,
        outbound: Boolean(state.outboundInstalled),
        outboundChecked: state.outboundChecked,
        outboundBlocked: state.outboundBlocked,
        inboundBlocked: state.inboundBlocked,
      }));
    }
    const decision = inboundDecision(req);
    if (!decision.allow) {
      remember(state, state.inboundBlocked, { method: String(req.method).toUpperCase(), path: pathOf(req.url) });
      console.warn(`[local-write-guard] ${decision.reason}`);
      res.writeHead(403, { "Content-Type": "application/json", "Cache-Control": "no-store", [GUARD_HEADER]: "blocked" });
      return res.end(JSON.stringify({ error: refusal(decision.reason) }));
    }
    return handle(req, res);
  };
}
