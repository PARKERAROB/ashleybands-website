import crypto from "node:crypto";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 120;

function configuredSecret() {
  const secret = process.env.SPONSOR_GIVE_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("Sponsorship link signing is not configured.");
  return secret;
}

function signature(encoded, secret) {
  return crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function signSponsorGiveToken(
  { businessId, prospectId },
  { secret = configuredSecret(), nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}
) {
  if (!businessId || !prospectId) throw new Error("Business and prospect are required.");
  const encoded = Buffer.from(JSON.stringify({
    b: String(businessId),
    p: String(prospectId),
    exp: Math.floor((nowMs + ttlMs) / 1000)
  })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function signSponsorStudentGiveToken(
  { linkId, studentId },
  { secret = configuredSecret(), nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}
) {
  if (!linkId || !studentId) throw new Error("Student sponsorship link is required.");
  const encoded = Buffer.from(JSON.stringify({
    l: String(linkId),
    s: String(studentId),
    exp: Math.floor((nowMs + ttlMs) / 1000)
  })).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifySponsorGiveToken(
  token,
  { secret = configuredSecret(), nowMs = Date.now() } = {}
) {
  try {
    const raw = String(token || "");
    if (raw.length > 2048) return null;
    const [encoded, supplied] = raw.split(".");
    if (!encoded || !supplied) return null;
    const expected = signature(encoded, secret);
    if (supplied.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp <= Math.floor(nowMs / 1000)) return null;
    if (payload.l && payload.s) {
      return { linkId: String(payload.l), studentId: String(payload.s) };
    }
    if (!payload.b || !payload.p) return null;
    return { businessId: String(payload.b), prospectId: String(payload.p) };
  } catch {
    return null;
  }
}
