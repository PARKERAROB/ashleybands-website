# Local preview

Use this to look at changed public pages before release. Issue #96.

```sh
npm run preview:shots -- / /support-carnegie
```

It starts the guarded dev server on a free port, then saves a full-page phone (390px) and desktop
(1366px) screenshot of each route. Output goes to `.preview-shots/<timestamp>/` (ignored by Git),
with `report.json` beside the images. The console summary lists, per capture:

- horizontal overflow, with the widest elements;
- uncaught page errors and console errors;
- failed requests (4xx/5xx or network errors), as notes;
- every write the browser or server blocked.

Exit code 0 means no overflow and no errors. 1 means at least one capture needs attention.
2 means the tool itself failed.

Options: `--viewports phone`, `--out DIR`, `--timeout SECONDS`, and `--base-url http://localhost:3000`
to reuse a running `npm run dev`. A reused server must report an active guard.

## Why writes are blocked

`.env.local` holds production credentials. A local form submission, or even a GET to a route such
as the reclaim sweep, would change production data. Three layers stop that:

1. **Browser.** The preview aborts every request that is not GET or HEAD, to any origin.
2. **Inbound.** `npm run dev` runs `scripts/local-dev-server.mjs`, which answers every non-read
   request (POST, PUT, PATCH, DELETE, server actions) with 403 before Next sees it.
3. **Outbound.** The same server refuses every non-GET call leaving the process through `fetch`
   or `http(s).request`: Supabase writes and RPCs, PayPal, Resend.

`GET /__local-write-guard` on the dev server shows the guard state and what it blocked.

Nothing here ships to Vercel. Production request handling is unchanged.

## Allowing writes

Only when a write is the point of the session, and only with authorization for that task:

```sh
ALLOW_LOCAL_WRITES=1 npm run dev
```

The flag must come from the shell. A value in `.env.local` is ignored. `preview:shots` refuses to
run with it set.

## Known local differences

- Supabase RPCs are POST, so the guard blocks them. Pages that read through an RPC show their
  error state locally.
- The Carnegie total shows "temporarily unavailable". The funding route needs live PayPal.
- The Carnegie giving form is hidden unless `SPONSOR_FUNNEL_LIVE=true`. Set it in the shell for
  the run: `SPONSOR_FUNNEL_LIVE=true npm run preview:shots -- /support-carnegie`. The server
  inherits shell variables, and they take precedence over `.env.local`.
- The Next dev overlay is hidden in screenshots. Errors it would show are in the report.

## Browser

Playwright is a pinned devDependency (`playwright` 1.63.0, about 18 MB in `node_modules`, no install
script). It uses the Chromium headless shell in `~/Library/Caches/ms-playwright`. On a new Mac,
install it once:

```sh
npx playwright install chromium-headless-shell
```

## Checks

`npm run test:local-preview` proves each layer, including a real guarded dev server against a
synthetic backend. It is part of `npm run verify:change`.
