import { privateJson, privateServerError } from "@/lib/privateResponse";
import { logAudit, staffActor } from "@/lib/auditLog";
import { authorizeLetterReviewer, carnegieLettersAccess, staffLetterQueue } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// Staff review queue for Carnegie student letters (#106). Gated, then staff capability.
export async function GET(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeLetterReviewer(req);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const letters = await staffLetterQueue();
    await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "carnegie_student_letters", recordId: "review-queue", route: "/api/admin/carnegie-letters" });
    return privateJson({ letters });
  } catch (error) {
    return privateServerError("carnegie-letter-queue", error, "Letters could not be loaded.");
  }
}
