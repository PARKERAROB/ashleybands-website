// Family-facing portal messages. Keep server details (database text, field keys,
// internal codes) out of what parents see; log those on the server instead.

export const PORTAL_SIGNED_OUT_MESSAGE =
  "For your security, you were signed out. Sign in again with a new code and we'll bring you back here.";

export const PORTAL_TROUBLE_MESSAGE =
  "The Family Portal is having trouble right now. Please try again in a few minutes. If it keeps happening, email Mr. Parker.";

// Only same-site portal paths may be used as the post-sign-in destination.
// PortalClient applies the same rule when it reads ?next=.
export function isSafePortalNext(path) {
  return typeof path === "string" && path.startsWith("/portal/") && !path.startsWith("//");
}

export function portalSignInHref(path) {
  const next = isSafePortalNext(path) ? path : "/portal/review";
  return `/portal?next=${encodeURIComponent(next)}`;
}

// Turn a failed portal API response into a message for the family.
export function portalErrorText(response, data, fallback) {
  if (response?.status === 401) return PORTAL_SIGNED_OUT_MESSAGE;
  return data?.error || fallback;
}
