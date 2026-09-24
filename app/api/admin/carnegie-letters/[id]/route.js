import { privateJson, privateServerError } from "@/lib/privateResponse";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { carnegieLettersAccess, loadLetterById, updateStaffLetter } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// Staff review actions (#106): approve an exact version, return to draft with a note, mark
// printed, record a reported delivery. Staff never edit the student's words.
export async function POST(req, { params }) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.CARNEGIE_LETTERS_REVIEW);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const { id } = await params;
    const letter = await loadLetterById(id);
    if (!letter) return privateJson({ error: "Letter not found." }, 404);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return privateJson({ error: "Send the action as JSON." }, 400);
    const result = await updateStaffLetter(authorization.staff, letter, body);
    if (result.error) return privateJson({ error: result.error }, result.status);
    await logAudit({ actor: staffActor(authorization.staff), action: `letter.${String(body.action)}`, table: "carnegie_student_letters", recordId: letter.id, changes: { from: { status: letter.status, version: letter.version }, to: { status: result.letter.status, version: result.letter.version } }, route: "/api/admin/carnegie-letters/[id]" });
    return privateJson({ letter: result.letter });
  } catch (error) {
    return privateServerError("carnegie-letter-review", error, "The letter could not be updated.");
  }
}
