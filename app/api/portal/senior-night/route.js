import { privateJson } from "@/lib/privateResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { selfStudent, currentResponse } from "@/lib/seniorNightServer";
import { cleanAnswers, EVENT_KEY } from "@/lib/seniorNight.mjs";
export const runtime = "nodejs";
async function handle(request, write = false) {
  try {
    if (write && request.headers.get("origin") !== new URL(request.url).origin) return privateJson({ error: "Please save from the Ashley Bands page." }, 403);
    const identity = await selfStudent(request);
    if (identity.status) return privateJson({ error: identity.status === 401 ? "Please sign in with your school email." : "This form is for current Ashley Bands seniors using their own school account. Ask Mr. Parker to check your portal access if you cannot open it." }, identity.status);
    if (write) {
      const body = await request.json().catch(() => null);
      const answers = body && Object.keys(body).length === 1 ? cleanAnswers(body.answers) : null;
      if (!answers) return privateJson({ error: "Fill in every required box. Each answer has a length limit." }, 400);
      const { error } = await supabaseAdmin.from("senior_night_responses").upsert({ event_key: EVENT_KEY, student_id: identity.student.id, submitted_by_person_id: identity.personId, answers, source: "portal_student_self", updated_at: new Date().toISOString() }, { onConflict: "event_key,student_id" });
      if (error) throw error;
    }
    const response = await currentResponse(identity.student.id);
    return privateJson({ name: identity.student.display_name, answers: response?.answers || null, updatedAt: response?.updated_at || null });
  } catch { return privateJson({ error: "Your answers could not be loaded or saved. Please try again." }, 503); }
}
export const GET = (request) => handle(request);
export const PUT = (request) => handle(request, true);
