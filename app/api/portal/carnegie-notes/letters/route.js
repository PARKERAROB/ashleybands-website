import { privateJson, privateServerError } from "@/lib/privateResponse";
import { logAudit } from "@/lib/auditLog";
import { carnegieLettersAccess, createFamilyLetter, familyActor, portalPerson, portalViewer } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// Start a letter draft for one of this adult's trusted students (#106).
export async function POST(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const session = portalPerson(req);
  if (!session) return privateJson({ error: "Sign in to the Family Portal first." }, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Send the letter as JSON." }, 400);
  try {
    const viewer = await portalViewer(session.personId);
    const result = await createFamilyLetter(session.personId, body, viewer);
    if (result.error) return privateJson({ error: result.error }, result.status);
    await logAudit({ actor: familyActor(session, viewer), action: "create", table: "carnegie_student_letters", recordId: result.letter.id, changes: { status: result.letter.status, version: result.letter.version }, route: "/api/portal/carnegie-notes/letters" });
    return privateJson({ letter: result.letter }, 201);
  } catch (error) {
    return privateServerError("carnegie-letter-create", error, "The letter could not be saved.");
  }
}
