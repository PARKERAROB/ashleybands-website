import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { privateJson } from "@/lib/privateResponse";
import { STUDENT_FIELDS } from "@/lib/seniorNightServer";
import { EVENT_KEY, staffRows } from "@/lib/seniorNight.mjs";
export const runtime = "nodejs";
export async function GET(request) {
  try {
    const auth = await authorizeStaffRequest(request, STAFF_CAPABILITIES.SENIOR_NIGHT_READ);
    if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
    const { data: students, error } = await supabaseAdmin.from("portal_students").select(STUDENT_FIELDS).eq("status", "active").eq("grade_fall26", "12th Grade");
    if (error) throw error;
    const { data: responses, error: responseError } = students.length ? await supabaseAdmin.from("senior_night_responses").select("student_id,answers,updated_at").eq("event_key", EVENT_KEY).in("student_id", students.map((row) => row.id)) : { data: [], error: null };
    if (responseError) throw responseError;
    const rows = staffRows(students, responses);
    await logAudit({ actor: staffActor(auth.staff), action: "senior_night.view", table: "senior_night_responses", recordId: EVENT_KEY, changes: { student_count: rows.length }, route: "/api/admin/senior-night" });
    return privateJson({ rows });
  } catch { return privateJson({ error: "The Senior Night list could not be loaded. Please try again." }, 503); }
}
