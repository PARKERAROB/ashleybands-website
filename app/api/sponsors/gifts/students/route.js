import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Staff student lookup for crediting an offline Carnegie gift from a check memo (#103).
// Least data: id, display name and grade of active students matching the typed name.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  const q = (new URL(req.url).searchParams.get("q") || "").trim().replace(/[^\p{L}\p{M}' -]/gu, "").slice(0, 40);
  if (q.length < 2) return privateJson({ students: [] });
  const pattern = `*${q}*`;
  const { data, error } = await supabaseAdmin
    .from("portal_students")
    .select("id, display_name, grade_fall26")
    .eq("status", "active")
    .or(`display_name.ilike.${pattern},legal_first.ilike.${pattern},legal_last.ilike.${pattern},preferred_first.ilike.${pattern}`)
    .order("display_name", { ascending: true })
    .limit(10);
  if (error) return privateServerError("sponsor-gift-students", error, "Students could not be loaded.");
  await logAudit({ actor: staffActor(authorization.staff), action: "search", table: "portal_students", recordId: "offline-gift-student-credit", route: "/api/sponsors/gifts/students" });
  return privateJson({ students: (data || []).map((student) => ({ id: student.id, name: student.display_name, grade: student.grade_fall26 || null })) });
}
