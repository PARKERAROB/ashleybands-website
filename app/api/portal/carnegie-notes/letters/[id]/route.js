import { privateJson, privateServerError } from "@/lib/privateResponse";
import { logAudit } from "@/lib/auditLog";
import {
  carnegieLettersAccess,
  familyActor,
  loadFamilyLetter,
  portalPerson,
  studentForLetter,
  studentLinkCode,
  updateFamilyLetter
} from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

async function openLetter(req, params) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return { response: privateJson({ error: "Not found." }, 404) };
  const session = portalPerson(req);
  if (!session) return { response: privateJson({ error: "Sign in to the Family Portal first." }, 401) };
  const { id } = await params;
  const letter = await loadFamilyLetter(session.personId, id);
  // Another family's letter and a missing letter look the same.
  if (!letter) return { response: privateJson({ error: "Letter not found." }, 404) };
  return { session, letter };
}

export async function GET(req, { params }) {
  try {
    const opened = await openLetter(req, params);
    if (opened.response) return opened.response;
    const [student, code] = await Promise.all([studentForLetter(opened.letter), studentLinkCode(opened.letter.portal_student_id)]);
    return privateJson({ letter: opened.letter, student: student ? { id: student.id, firstName: student.firstName } : null, code });
  } catch (error) {
    return privateServerError("carnegie-letter-read", error, "The letter could not be loaded.");
  }
}

// Actions: save, submit, mark_printed, report_delivery. The student's words are stored as typed.
export async function PATCH(req, { params }) {
  try {
    const opened = await openLetter(req, params);
    if (opened.response) return opened.response;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return privateJson({ error: "Send the change as JSON." }, 400);
    const result = await updateFamilyLetter(opened.session.personId, opened.letter, body);
    if (result.error) return privateJson({ error: result.error }, result.status);
    if (result.letter !== opened.letter) {
      await logAudit({ actor: familyActor(opened.session), action: `letter.${String(body.action)}`, table: "carnegie_student_letters", recordId: opened.letter.id, changes: { from: { status: opened.letter.status, version: opened.letter.version }, to: { status: result.letter.status, version: result.letter.version } }, route: "/api/portal/carnegie-notes/letters/[id]" });
    }
    return privateJson({ letter: result.letter });
  } catch (error) {
    return privateServerError("carnegie-letter-update", error, "The letter could not be updated.");
  }
}
