import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const [{ data: prospects, error: pErr }, { data: dedup, error: dErr }, { data: families }] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select(
        "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, confirmed_by_lead, confirmed_at, created_at, family:families(id, display_name, student_first, student_last, section), business:businesses(id, name_display, category)"
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("prospect_dedup").select("*"),
    supabaseAdmin.from("families").select("id, display_name, student_first, student_last, section, created_at")
  ]);

  if (pErr) return privateServerError("sponsors-dashboard", pErr, "Sponsorship records could not be loaded.");
  if (dErr) return privateServerError("sponsors-dashboard", dErr, "Sponsorship records could not be loaded.");

  const totals = (prospects || []).reduce(
    (acc, p) => {
      acc.count += 1;
      acc[p.status] = (acc[p.status] || 0) + 1;
      if (p.status === "yes" && p.committed_amount) {
        // Reported = what families self-entered. Confirmed = lead has the signed
        // form. Only confirmed money should be treated as actually raised.
        acc.committed_amount += Number(p.committed_amount);
        if (p.confirmed_by_lead) acc.committed_confirmed += Number(p.committed_amount);
      }
      return acc;
    },
    { count: 0, pending: 0, yes: 0, no: 0, later: 0, committed_amount: 0, committed_confirmed: 0 }
  );

  await logAudit({
    actor: staffActor(staff),
    action: "view",
    table: "prospects,businesses,families",
    recordId: "sponsorship-dashboard",
    route: "/api/sponsors/dashboard",
  });

  return privateJson({
    staff: { display_name: staff.display_name, role: staff.role },
    prospects: prospects || [],
    dedup: dedup || [],
    families: families || [],
    totals
  });
}
