import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { resolveSelfStudent, SURVEY_KEY } from "@/lib/percussionPreferences.mjs";
export const STUDENT_FIELDS = "id,display_name,status,ensemble_2026,band_class_2026";
export async function selfStudent(request) {
  let session; try { session=readPortalSession(request); } catch { return {status:401}; }
  if (!session?.personId) return {status:401};
  const [{data:person,error:personError},{data:links,error:linkError}] = await Promise.all([
    supabaseAdmin.from("portal_people").select("person_type").eq("id",session.personId).maybeSingle(),
    supabaseAdmin.from("portal_student_people").select(`role,relationship_status,student:portal_students(${STUDENT_FIELDS})`).eq("person_id",session.personId).eq("role","student").eq("relationship_status","trusted"),
  ]);
  if(personError || linkError) throw new Error("Identity unavailable");
  const student=resolveSelfStudent(person,links || []);
  return student ? {student,personId:session.personId} : {status:403};
}
export async function currentResponse(studentId) {
  const {data,error}=await supabaseAdmin.from("percussion_part_preferences").select("choices,updated_at").eq("survey_key",SURVEY_KEY).eq("student_id",studentId).maybeSingle();
  if(error) throw error; return data;
}
