import crypto from "node:crypto";

export function decryptRegimentOsContent(payload) {
  if (payload?.version !== 1) throw new Error("Unsupported Regiment OS content format.");
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured.");

  const key = crypto.createHash("sha256").update(`regiment-os-content:${secret}`).digest();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final()
  ]).toString("utf8");
  return JSON.parse(plaintext);
}
