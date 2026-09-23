// Guarded local Next dev server (#96). `npm run dev` runs this instead of bare `next dev`.
// .env.local holds production credentials, so writes are refused unless the launching shell
// sets ALLOW_LOCAL_WRITES=1. Values in .env.local cannot enable writes: the flag is read
// before Next loads that file.
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  OVERRIDE_ENV,
  PROBE_PATH,
  createGuardState,
  createGuardedHandler,
  installOutboundGuard,
  writesAllowed,
} from "./lib/local-write-guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const port = Number(option("port", process.env.PORT || 3000));
const hostname = option("hostname", "localhost");
const allowWrites = writesAllowed(process.env);
const state = createGuardState();
// Telemetry is a Next outbound POST, not app data; keep it out of the blocked-write list.
process.env.NEXT_TELEMETRY_DISABLED ??= "1";

if (allowWrites) {
  console.warn(`\n!! ${OVERRIDE_ENV}=1: the local write guard is OFF.`);
  console.warn("!! Requests from this server can write to production Supabase, PayPal and Resend.\n");
} else {
  installOutboundGuard(state, { http, https });
}

const { default: next } = await import("next");
const server = http.createServer();
const app = next({ dev: true, dir: root, hostname, port, httpServer: server });
const handle = app.getRequestHandler();
await app.prepare();

server.on("request", allowWrites ? handle : createGuardedHandler(handle, state));
server.listen(port, hostname, () => {
  const base = `http://${hostname}:${port}`;
  console.log(`> Local dev server: ${base}`);
  console.log(allowWrites
    ? "> Local write guard: OFF"
    : `> Local write guard: ON (status at ${base}${PROBE_PATH})`);
});
