import crypto from "node:crypto";

// Signed, stateless token for the day-6 reclaim nudge magic links (build-spec §8). Encodes
// the claimed business + family so the "I went to see them" / "Send it to the pool" buttons
// can act without a portal session (the family clicks from their email). HMAC over
// PORTAL_SESSION_SECRET, with an expiry — no new DB column needed.

function getSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return secret;
}

export function signClaimToken({ businessId, familyId, ttlSeconds = 60 * 60 * 72 }) {
  const body = { b: businessId, f: familyId, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyClaimToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  try {
    const expected = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { businessId: payload.b, familyId: payload.f };
  } catch {
    return null;
  }
}
