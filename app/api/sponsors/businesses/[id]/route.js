import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

const ALLOWED = [
  "name_display",
  "address",
  "city",
  "zip",
  "phone",
  "email",
  "website",
  "contact_person",
  "contact_title",
  "category",
  "zone",
  "outreach_status",
  "prior_sponsor",
  "notes"
];

export async function PATCH(req, { params }) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update = {};
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  // Stamp willing_at / declined_at when status transitions to those.
  if (update.outreach_status === "willing") update.willing_at = new Date().toISOString();
  if (update.outreach_status === "declined") update.declined_at = new Date().toISOString();

  try {
    await logAuditRequired({ actor: staffActor(authorization.staff), action: "update_requested", table: "businesses", recordId: id, route: "/api/sponsors/businesses/[id]", changes: { fields: Object.keys(update) } });
  } catch (error) {
    return privateServerError("sponsor-business-audit", error, "The sponsor business could not be updated.");
  }

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return privateServerError("sponsor-business", error, "The sponsor business could not be updated.");
  return privateJson({ business: data });
}

export async function DELETE(req, { params }) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const { id } = await params;
  try {
    await logAuditRequired({ actor: staffActor(authorization.staff), action: "delete_requested", table: "businesses", recordId: id, route: "/api/sponsors/businesses/[id]" });
  } catch (error) {
    return privateServerError("sponsor-business-audit", error, "The sponsor business could not be removed.");
  }
  const { error } = await supabaseAdmin.from("businesses").delete().eq("id", id);
  if (error) return privateServerError("sponsor-business", error, "The sponsor business could not be removed.");
  return privateJson({ ok: true });
}
