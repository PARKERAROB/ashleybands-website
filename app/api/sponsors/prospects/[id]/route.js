import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

const ALLOWED = [
  "status",
  "contact_name",
  "contact_email",
  "contact_phone",
  "business_address",
  "relationship_note",
  "contact_mode",
  "dropped_off_at",
  "follow_up_at",
  "ask_again_at",
  "committed_amount",
  "committed_tier",
  "sent_to_lead"
];

async function authorize(req, prospectId) {
  if (!sponsorFunnelLive()) {
    return { ok: false, status: 404, error: "Sponsorship area is not open yet." };
  }
  const resolved = await resolveSponsorFamily(req);
  if (resolved?.family) {
    const { data: prospect, error } = await supabaseAdmin
      .from("prospects")
      .select("id, family_id, business_id, lead_kind")
      .eq("id", prospectId)
      .eq("family_id", resolved.family.id)
      .maybeSingle();
    if (error) return { ok: false, status: 500, error: "The sponsorship record could not be verified.", cause: error };
    if (prospect) return { ok: true, prospect, actor: "family", family: resolved.family };
  }

  const staffAuthorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_WRITE);
  if (!staffAuthorization.ok) {
    return resolved?.family
      ? { ok: false, status: 404, error: "Prospect not found" }
      : { ok: false, status: staffAuthorization.status, error: staffAuthorization.error };
  }
  const { data: prospect, error } = await supabaseAdmin
    .from("prospects")
    .select("id, family_id, business_id, lead_kind")
    .eq("id", prospectId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: "The sponsorship record could not be verified.", cause: error };
  if (!prospect) return { ok: false, status: 404, error: "Prospect not found" };
  return { ok: true, prospect, actor: "staff", staff: staffAuthorization.staff };
}

function actorFor(auth) {
  return auth.actor === "staff"
    ? staffActor(auth.staff)
    : { type: "parent", id: auth.family?.id, name: auth.family?.display_name };
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const auth = await authorize(req, id);
  if (!auth.ok) return auth.status >= 500
    ? privateServerError("sponsor-prospect", auth.cause, auth.error)
    : privateJson({ error: auth.error }, auth.status);

  const body = await req.json().catch(() => ({}));
  const update = {};
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key];
  }
  if (body.status === "yes" && body.sent_to_lead === true && !body.sent_at) {
    update.sent_at = new Date().toISOString();
  }

  // Mark-contacted (build-spec §4 step 5): the student reports they made contact. Record the
  // timestamp and — if this is a claimed warmed lead — freeze the reclaim timer so the
  // business stays theirs (claim_contacted_at), instead of auto-releasing back to the pool.
  const contactedAt = body.contacted === true ? new Date().toISOString() : null;
  if (contactedAt) {
    update.contacted_at = contactedAt;
    if (!("dropped_off_at" in update)) update.dropped_off_at = contactedAt.slice(0, 10);
  }

  // Confirming money is a staff-only action — families can report a "yes" but only
  // the sponsor lead, holding the signed form, marks it confirmed (banked).
  if ("confirmed_by_lead" in body) {
    if (auth.actor !== "staff") {
      return privateJson({ error: "Only staff can confirm a commitment." }, 403);
    }
    const confirmed = body.confirmed_by_lead === true;
    update.confirmed_by_lead = confirmed;
    update.confirmed_at = confirmed ? new Date().toISOString() : null;
  }

  try {
    await logAuditRequired({ actor: actorFor(auth), action: "update_requested", table: "prospects", recordId: id, route: "/api/sponsors/prospects/[id]", changes: { fields: Object.keys(update) } });
  } catch (error) {
    return privateServerError("sponsor-prospect-audit", error, "The sponsorship prospect could not be updated.");
  }
  if (contactedAt) {
    await supabaseAdmin
      .from("businesses")
      .update({ claim_contacted_at: contactedAt })
      .eq("id", auth.prospect.business_id)
      .eq("claimed_by_family_id", auth.prospect.family_id);
  }

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .update(update)
    .eq("id", id)
    .select(
      "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, contact_mode, lead_kind, contacted_at, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, confirmed_by_lead, confirmed_at, business:businesses(id, name_display)"
    )
    .single();
  if (error) return privateServerError("sponsor-prospect", error, "The sponsorship prospect could not be updated.");
  return privateJson({ prospect: data });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const auth = await authorize(req, id);
  if (!auth.ok) return auth.status >= 500
    ? privateServerError("sponsor-prospect", auth.cause, auth.error)
    : privateJson({ error: auth.error }, auth.status);

  try {
    await logAuditRequired({ actor: actorFor(auth), action: "delete_requested", table: "prospects", recordId: id, route: "/api/sponsors/prospects/[id]" });
  } catch (error) {
    return privateServerError("sponsor-prospect-audit", error, "The sponsorship prospect could not be removed.");
  }
  const { error } = await supabaseAdmin.from("prospects").delete().eq("id", id);
  if (error) return privateServerError("sponsor-prospect", error, "The sponsorship prospect could not be removed.");
  return privateJson({ ok: true });
}
