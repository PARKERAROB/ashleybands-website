import crypto from "node:crypto";

// Signed, httpOnly family session cookie. Mirrors staffAuthCookie. Payload carries
// { id, token }; the API still checks the token against families.session_token in
// the DB, so rotating that token revokes the session. Reusing PORTAL_SESSION_SECRET
// (already required for the staff cookie) so there's no new env var to configure.

const FAMILY_COOKIE = "ab_family_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return secret;
}

export function createFamilyCookieValue({ id, token }) {
  const body = { id, token, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function readFamilyCookie(request) {
  const cookie = request?.cookies?.get?.(FAMILY_COOKIE)?.value;
  if (!cookie) return null;
  const [encoded, sig] = cookie.split(".");
  if (!encoded || !sig) return null;
  try {
    const expected = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id, token: payload.token };
  } catch {
    return null;
  }
}

export function setFamilyCookie(response, value) {
  response.cookies.set(FAMILY_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearFamilyCookie(response) {
  response.cookies.set(FAMILY_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
