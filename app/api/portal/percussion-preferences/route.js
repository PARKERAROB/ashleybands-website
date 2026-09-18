import { privateJson } from "@/lib/privateResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { selfStudent, currentResponse } from "@/lib/percussionPreferencesServer";
import { validChoices, SURVEY_KEY } from "@/lib/percussionPreferences.mjs";
export const runtime="nodejs";
async function handle(request,write=false) {
  try {
    if(write && request.headers.get("origin") !== new URL(request.url).origin) return privateJson({error:"Please save from the Ashley Bands page."},403);
    const identity=await selfStudent(request);
    if(identity.status) return privateJson({error:identity.status===401 ? "Please sign in with your school email." : "This form is for current Percussion Ensemble students using their own school account. Ask Mr. Parker to check your portal access if you cannot open it."},identity.status);
    if(write) {
      const body=await request.json().catch(()=>null);
      if(!body || Object.keys(body).length!==1 || !validChoices(body.choices)) return privateJson({error:"Choose one listed part for each of the six pieces."},400);
      const {error}=await supabaseAdmin.from("percussion_part_preferences").upsert({survey_key:SURVEY_KEY,student_id:identity.student.id,submitted_by_person_id:identity.personId,choices:body.choices,source:"portal_student_self",updated_at:new Date().toISOString()},{onConflict:"survey_key,student_id"});
      if(error) throw error;
    }
    const response=await currentResponse(identity.student.id);
    return privateJson({name:identity.student.display_name,choices:response?.choices || null,updatedAt:response?.updated_at || null});
  } catch { return privateJson({error:"Your preferences could not be loaded or saved. Please try again."},503); }
}
export const GET=request=>handle(request);
export const PUT=request=>handle(request,true);
