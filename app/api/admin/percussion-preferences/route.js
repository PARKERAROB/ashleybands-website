import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { privateJson, PRIVATE_RESPONSE_HEADERS } from "@/lib/privateResponse";
import { STUDENT_FIELDS } from "@/lib/percussionPreferencesServer";
import { SURVEY_KEY, directorRows, preferencesCsv } from "@/lib/percussionPreferences.mjs";
export const runtime="nodejs";
export async function GET(request) {
  try {
    const auth=await authorizeStaffRequest(request,STAFF_CAPABILITIES.PERCUSSION_PREFERENCES_READ);
    if(!auth.ok) return privateJson({error:auth.error},auth.status);
    const {data:students,error}=await supabaseAdmin.from("portal_students").select(STUDENT_FIELDS).eq("status","active").eq("ensemble_2026","Percussion Ensemble").eq("band_class_2026","Yes");
    if(error) throw error;
    const {data:responses,error:responseError}=students.length ? await supabaseAdmin.from("percussion_part_preferences").select("student_id,choices,updated_at").eq("survey_key",SURVEY_KEY).in("student_id",students.map(row=>row.id)) : {data:[],error:null};
    if(responseError) throw responseError;
    const rows=directorRows(students,responses);
    const csv=new URL(request.url).searchParams.get("format")==="csv";
    await logAudit({actor:staffActor(auth.staff),action:csv?"percussion_preferences.export":"percussion_preferences.view",table:"percussion_part_preferences",recordId:SURVEY_KEY,changes:{student_count:rows.length},route:"/api/admin/percussion-preferences"});
    if(csv) return new Response(preferencesCsv(rows),{headers:{...PRIVATE_RESPONSE_HEADERS,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="percussion-preferences-fall-2026.csv"'}});
    return privateJson({rows});
  } catch {return privateJson({error:"The director view could not be loaded. Please try again."},503);}
}
