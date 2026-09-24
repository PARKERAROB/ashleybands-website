import { privateJson, privateServerError } from "@/lib/privateResponse";
import { logAudit } from "@/lib/auditLog";
import { carnegieLettersAccess, familyActor, familyDashboard, portalPerson } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// The family's Carnegie notes page (#106): each trusted student's notes, deposit line, link and
// letters. Gated: 404 unless CARNEGIE_LETTERS_MODE allows this request.
export async function GET(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const session = portalPerson(req);
  if (!session) return privateJson({ error: "Sign in to the Family Portal first." }, 401);
  try {
    const students = await familyDashboard(session.personId);
    await logAudit({ actor: familyActor(session), action: "view", table: "carnegie_student_letters", recordId: "family-carnegie-notes", route: "/api/portal/carnegie-notes" });
    return privateJson({ students });
  } catch (error) {
    return privateServerError("carnegie-notes", error, "Your Carnegie notes could not be loaded.");
  }
}
