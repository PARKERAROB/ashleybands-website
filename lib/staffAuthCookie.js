import crypto from "node:crypto";

// Signed, httpOnly staff session cookie. Replaces the localStorage token (which
// was XSS-exposed). Payload carries { id, token }; validateStaffRequest still
// checks the token against staff.session_token in the DB, so rotating that token
// revokes the session.

const STAFF_COOKIE = "ab_staff_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return secret;
}

export function createStaffCookieValue({ id, token }) {
  const body = { id, token, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function readStaffCookie(request) {
  const cookie = request?.cookies?.get?.(STAFF_COOKIE)?.value;
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

export function setStaffCookie(response, value) {
  response.cookies.set(STAFF_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearStaffCookie(response) {
  response.cookies.set(STAFF_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
