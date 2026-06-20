import crypto from "node:crypto";

const SESSION_COOKIE = "ab_portal_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 6;

// Lock a code after this many wrong attempts. 5 guesses against a 1,000,000
// space inside a short TTL is negligible brute-force risk.
export const MAX_CODE_ATTEMPTS = 5;

// A 6-digit numeric sign-in code (zero-padded), emailed as inert text. There is
// no link for Microsoft Safe Links to detonate and burn before the human reads it.
export function createNumericCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// Hash the code BOUND TO THE EMAIL. Codes aren't globally unique (two families
// can hold 123456 at once), so salting by email keeps stored hashes distinct and
// makes the 1M space non-trivial to reverse from a DB leak.
export function hashCode(email, code) {
  return hashToken(`${String(email || "").toLowerCase()}:${String(code || "").trim()}`);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function createPortalSession(payload) {
  const secret = getSessionSecret();
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function readPortalSession(request) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  const [encoded, sig] = cookie.split(".");
  if (!encoded || !sig) return null;

  const expected = crypto.createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function setPortalSessionCookie(response, value) {
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export function clearPortalSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

function getSessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return secret;
}
