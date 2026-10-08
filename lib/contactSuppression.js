// #188: one shared opt-out check. Every email path calls dropSuppressed before the
// provider: resolveAudience (so previews and queues never hold a suppressed
// address) and sendPortalEmail (the only Resend call). A failed lookup throws;
// nothing is ever sent unfiltered.

const LOOKUP_BATCH_SIZE = 100;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export class ContactSuppressedError extends Error {
  constructor() {
    super("Recipient is on the contact suppression list.");
    this.code = "contact_suppressed";
  }
}

// items: email strings or objects with an .email field.
// Returns { kept, suppressedCount }: kept keeps the original order and shape;
// suppressedCount is distinct suppressed addresses (not rows).
export async function dropSuppressed(items, client) {
  const list = items || [];
  const emails = [...new Set(list.map((item) => normalizeEmail(typeof item === "string" ? item : item?.email)).filter(Boolean))];
  const suppressed = new Set();
  for (let i = 0; i < emails.length; i += LOOKUP_BATCH_SIZE) {
    const { data, error } = await client
      .from("contact_suppressions")
      .select("value_normalized")
      .eq("contact_type", "email")
      .in("value_normalized", emails.slice(i, i + LOOKUP_BATCH_SIZE));
    if (error || !Array.isArray(data)) throw new Error(`Contact suppression lookup failed: ${error?.message || "no data"}`);
    for (const row of data) suppressed.add(normalizeEmail(row.value_normalized));
  }
  const kept = list.filter((item) => !suppressed.has(normalizeEmail(typeof item === "string" ? item : item?.email)));
  return { kept, suppressedCount: suppressed.size };
}

// Row update for a failed send: a suppression hit is "skipped", anything else
// "failed". Dispatch loops count by the returned send_status (#190).
export function sendFailureUpdate(err) {
  return err?.code === "contact_suppressed"
    ? { send_status: "skipped", send_error: "contact_suppressed" }
    : { send_status: "failed", send_error: String(err?.message || err).slice(0, 500) };
}
