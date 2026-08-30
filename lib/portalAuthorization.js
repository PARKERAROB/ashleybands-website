import { readPortalSession } from "@/lib/portalTokens";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function authorizePortalStudentRequest(request, studentId, { strong = false } = {}) {
  const session = readPortalSession(request);
  if (!session?.personId) return { ok: false, status: 401, error: "Not signed in." };
  if (!studentId) return { ok: false, status: 400, error: "Choose a student." };

  const { data: relationship, error } = await supabaseAdmin
    .from("portal_student_people")
    .select("id,student_id,person_id,role,relationship_status,assurance_level,trust_source")
    .eq("person_id", session.personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: "Family access could not be verified." };
  if (!relationship) return { ok: false, status: 403, error: "Not authorized for this student." };
  if (strong && !["medium", "high"].includes(relationship.assurance_level)) {
    return {
      ok: false,
      status: 403,
      code: "STRONG_RELATIONSHIP_REQUIRED",
      error: "This family connection must be verified before onboarding can be opened."
    };
  }

  const [{ data: person }, { data: student }] = await Promise.all([
    supabaseAdmin.from("portal_people").select("id,person_type,display_name").eq("id", session.personId).maybeSingle(),
    supabaseAdmin
      .from("portal_students")
      .select("id,source_student_id,legal_first,legal_last,preferred_first,display_name,grade_fall26,school_email,cell_phone,status,source,updated_at")
      .eq("id", studentId)
      .maybeSingle()
  ]);

  if (!person || !student || String(student.status || "").toLowerCase() !== "active") {
    return { ok: false, status: 404, error: "Current student record not found." };
  }

  return { ok: true, session, relationship, person, student };
}
