import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Central append-only audit trail. Every admin write (and select PII reads)
// should call this so an actor + action is on record — see
// supabase/migrations/0027_audit_log.sql for the table + rationale.
//
// Fire-and-forget SAFE: this never throws into the caller. A logging failure
// must never block or fail the underlying request; it only gets a console
// warning so the miss is visible in server logs.
//
// actor: { type: "staff"|"parent"|"system", id?, name? }
export async function logAudit({ actor, action, table, recordId, changes, route }) {
  try {
    const { error } = await supabaseAdmin.from("audit_log").insert({
      actor_type: actor?.type || "system",
      actor_id: actor?.id != null ? String(actor.id) : null,
      actor_name: actor?.name || null,
      action: String(action || ""),
      table_name: String(table || ""),
      record_id: recordId != null ? String(recordId) : null,
      changes: changes ?? null,
      route: route || null
    });
    if (error) {
      console.warn("[auditLog] insert failed:", error.message);
    }
  } catch (err) {
    console.warn("[auditLog] unexpected failure:", err?.message || err);
  }
}

// Use this for sensitive exports and other actions that must not succeed
// without durable attribution. Unlike logAudit, failures are intentionally
// returned to the caller so the protected action can stop.
export async function logAuditRequired({ actor, action, table, recordId, changes, route }) {
  const { error } = await supabaseAdmin.from("audit_log").insert({
    actor_type: actor?.type || "system",
    actor_id: actor?.id != null ? String(actor.id) : null,
    actor_name: actor?.name || null,
    action: String(action || ""),
    table_name: String(table || ""),
    record_id: recordId != null ? String(recordId) : null,
    changes: changes ?? null,
    route: route || null,
  });
  if (error) throw new Error(`Required audit record failed: ${error.message}`);
}

// Convenience for staff-attributed actions (the common case across admin routes).
export function staffActor(staff) {
  return { type: "staff", id: staff?.id, name: staff?.display_name };
}
