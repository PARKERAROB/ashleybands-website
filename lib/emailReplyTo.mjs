// Portal and broadcast mail is sent from a no-MX address that cannot receive replies.
// Replies go to a monitored inbox: an explicit per-send override, else PORTAL_EMAIL_REPLY_TO,
// else the director's school address. — Rob, 2026-09-30
export const DEFAULT_PORTAL_REPLY_TO = "robert.parker@nhcs.net";

export function resolveReplyTo(override, env = process.env) {
  const explicit = String(override || "").trim();
  if (explicit) return explicit;
  const configured = String(env?.PORTAL_EMAIL_REPLY_TO || "").trim();
  return configured || DEFAULT_PORTAL_REPLY_TO;
}
