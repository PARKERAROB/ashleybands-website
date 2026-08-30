import { NextResponse } from "next/server";

export const PRIVATE_RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
});

export function privateJson(body, status = 200, headers = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", PRIVATE_RESPONSE_HEADERS["Cache-Control"]);
  return NextResponse.json(body, {
    status,
    headers: responseHeaders,
  });
}

export function privateServerError(context, error, message = "This request could not be completed.") {
  console.error(`[${context}]`, error?.message || error);
  return privateJson({ error: message }, 500);
}

// Drop-in response facade for larger legacy private routes. It preserves the
// familiar NextResponse.json(body, init) call shape while enforcing no-store.
export const PrivateResponse = Object.freeze({
  json(body, init = {}) {
    return privateJson(body, init.status || 200, init.headers || {});
  },
});
