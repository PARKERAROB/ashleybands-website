import crypto from "node:crypto";

const COOKIE_NAME = "ab_regiment_os_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.PORTAL_SESSION_SECRET;
  if (!value) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return value;
}

export function createRegimentOsCookieValue() {
  const encoded = Buffer.from(JSON.stringify({
    scope: "regiment-os-review",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function validateRegimentOsRequest(request) {
  const cookie = request?.cookies?.get?.(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const [encoded, signature] = cookie.split(".");
  if (!encoded || !signature) return false;

  try {
    const expected = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.scope === "regiment-os-review"
      && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function setRegimentOsCookie(response, value) {
  response.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearRegimentOsCookie(response) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
