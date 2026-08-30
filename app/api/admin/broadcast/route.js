import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadAttributeFacets } from "@/lib/audience";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Send log + the attribute facets that generate the audience picker.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  try {
    const [{ data: broadcasts, error }, facets] = await Promise.all([
      supabaseAdmin
        .from("broadcasts")
        .select("id, subject, recipient_axis, status, recipient_count, created_by, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      loadAttributeFacets()
    ]);
    if (error) throw error;
    await logAuditRequired({ actor: staffActor(staff), action: "view_broadcast_workspace", table: "broadcasts,portal_student_attributes", recordId: "recent", route: "/api/admin/broadcast" });
    return privateJson({ staff: { displayName: staff.display_name, role: staff.role }, broadcasts: broadcasts || [], facets });
  } catch (error) {
    return privateServerError("broadcast-workspace", error, "The broadcast workspace could not be loaded or durably attributed.");
  }
}
