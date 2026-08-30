import crypto from "node:crypto";

const TTL_SECONDS = 10 * 60;

function secret() {
  const value = process.env.PORTAL_SESSION_SECRET;
  if (!value) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return value;
}

function sign(encoded) {
  return crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function audienceDigest(recipients) {
  const identities = (recipients || [])
    .map((row) => `${String(row.student_id || "")}:${String(row.person_id || "")}:${String(row.email || "").trim().toLowerCase()}`)
    .sort();
  return crypto.createHash("sha256").update(JSON.stringify(identities)).digest("hex");
}

export function createAudienceConfirmation({ staffId, audienceFilter, recipientAxis, recipients }) {
  const payload = {
    staffId: String(staffId),
    audienceFilter: audienceFilter || {},
    recipientAxis,
    count: recipients.length,
    digest: audienceDigest(recipients),
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAudienceConfirmation(token, { staffId, audienceFilter, recipientAxis, recipients }) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return false;
  try {
    const expected = sign(encoded);
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!Number.isFinite(payload.exp) || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return payload.staffId === String(staffId)
      && payload.recipientAxis === recipientAxis
      && canonicalJson(payload.audienceFilter) === canonicalJson(audienceFilter || {})
      && payload.count === recipients.length
      && payload.digest === audienceDigest(recipients);
  } catch {
    return false;
  }
}

export function enforcedBroadcastAudience(body = {}) {
  const directStudentId = String(body.directStudentId || "").trim();
  if (directStudentId) {
    return {
      directStudentId,
      audienceFilter: { match: "all", predicates: [{ key: "student_id", op: "in", values: [directStudentId] }] },
      recipientAxis: "both",
    };
  }
  return {
    directStudentId: "",
    audienceFilter: body.audienceFilter || {},
    recipientAxis: ["students", "guardians", "both"].includes(body.recipientAxis) ? body.recipientAxis : "guardians",
  };
}
