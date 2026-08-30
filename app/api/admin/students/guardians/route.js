import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { privateJson } from "@/lib/privateResponse";

export const runtime = "nodejs";

function text(value) {
  return String(value || "").trim();
}

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.STUDENTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const body = await request.json().catch(() => ({}));
  const studentId = text(body.studentId);
  const name = text(body.name);
  const email = text(body.email);
  const phone = text(body.phone);
  if (!studentId || !name) return privateJson({ error: "Student and guardian name are required." }, 400);
  if (!email && !phone) return privateJson({ error: "Provide at least an email or phone." }, 400);

  const { data, error } = await supabaseAdmin.rpc("staff_add_guardian_with_audit", {
    p_student_id: studentId,
    p_name: name,
    p_email: email || null,
    p_phone: phone || null,
    p_role: text(body.role) || "Parent",
    p_primary: Boolean(body.primary),
    p_actor_staff_id: authorization.staff.id,
    p_route: "/api/admin/students/guardians",
  });
  if (error) {
    console.error("[staff-add-guardian]", error.message);
    return privateJson({ error: "The guardian link was not completed." }, 400);
  }
  return privateJson({ ok: true, personId: data?.personId || null });
}
