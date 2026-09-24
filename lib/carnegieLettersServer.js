import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { readPortalSession } from "@/lib/portalTokens";
import { trustedStudentIds } from "@/lib/billing";
import { ensureSponsorStudentLinks } from "@/lib/sponsorStudentLinks";
import { CARNEGIE_CAMPAIGN } from "@/lib/sponsorCampaigns.mjs";
import { CARNEGIE_DEPOSIT_CATEGORY } from "@/lib/carnegieTripConstants";
import { createPendingGift } from "@/lib/sponsorGifts";
import { confirmGift } from "@/lib/sponsorRecognition";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { printedWords, validateCorrection } from "@/lib/carnegieLetterCorrections.mjs";
import {
  LETTER_TEMPLATE_VERSION,
  confirmationFromReview,
  expectedConfirmation,
  pendingExpectedCents,
  sponsorGiftMethod,
  validateExpectedGift,
  pendingReportedCents,
  rejectionReason,
  validateReportedGift,
  carnegieLettersMode,
  carnegieStudentPath,
  carnegieStudentReadableUrl,
  deliveryChannel,
  letterContentChanged,
  nextLetterStatus,
  statusAfterEdit,
  studentFirstName,
  validateLetterContent
} from "@/lib/carnegieLetters.mjs";

// Server side of Carnegie student letters (#106). Every entry point checks the gate first.

// requestLike: a Request, or { cookies } from next/headers. Both expose cookies.get(name).value.
export async function carnegieLettersAccess(requestLike) {
  const mode = carnegieLettersMode();
  if (mode === "off") return { open: false, mode, staff: null };
  const staff = await validateStaffRequest(requestLike).catch(() => null);
  if (mode === "staff" && !staff) return { open: false, mode, staff: null };
  return { open: true, mode, staff };
}

export function portalPerson(requestLike) {
  try {
    const session = readPortalSession(requestLike);
    return session?.personId ? session : null;
  } catch {
    return null;
  }
}

export function familyActor(session, viewer = "family") {
  return { type: viewer === "student" ? "student" : "parent", id: session.personId, name: session.email };
}

const LETTER_FIELDS = "id, portal_student_id, recipient_type, recipient_name, recipient_email, delivery_channel, meaning_text, help_text, template_version, status, version, approved_version, approved_at, review_note, submitted_at, printed_at, delivery_reported_at, approved_correction_id, created_at, updated_at";

async function activeStudents(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin
    .from("portal_students")
    .select("id, display_name, preferred_first, legal_first, legal_last, status")
    .in("id", ids)
    .eq("status", "active")
    .order("legal_last", { ascending: true });
  if (error) throw new Error("Students could not be loaded.");
  return (data || []).map((student) => ({
    id: student.id,
    displayName: String(student.display_name || [student.legal_first, student.legal_last].filter(Boolean).join(" ") || "Band student").trim(),
    firstName: studentFirstName(student.preferred_first || student.legal_first || student.display_name) || "Band student"
  }));
}

// Who is signed in: a student (own school email, #108) or a family adult. Students see only their
// own notes, letters and the builder: no deposit, no reported gifts, no family contacts.
export async function portalViewer(personId) {
  const { data, error } = await supabaseAdmin.from("portal_people").select("person_type").eq("id", personId).maybeSingle();
  if (error) throw new Error("Your portal profile could not be loaded.");
  return data?.person_type === "student" ? "student" : "family";
}

// The students this signed-in adult may act for: the existing trusted-guardian rule used by billing.
export async function familyStudents(personId) {
  return activeStudents(await trustedStudentIds(personId));
}

export async function confirmedNotesCents(studentIds) {
  const totals = new Map(studentIds.map((id) => [id, 0]));
  if (!studentIds.length) return totals;
  const { data, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .select("portal_student_id, amount_cents")
    .in("portal_student_id", studentIds)
    .eq("campaign_code", CARNEGIE_CAMPAIGN)
    .eq("status", "confirmed");
  if (error) throw new Error("Notes could not be loaded.");
  for (const gift of data || []) totals.set(gift.portal_student_id, (totals.get(gift.portal_student_id) || 0) + Number(gift.amount_cents || 0));
  return totals;
}

// The existing family trip payment record: a completed Carnegie deposit payment.
export async function depositPaidCents(studentIds) {
  const totals = new Map();
  if (!studentIds.length) return totals;
  const { data, error } = await supabaseAdmin
    .from("fee_payments")
    .select("student_id, amount_cents")
    .in("student_id", studentIds)
    .eq("category", CARNEGIE_DEPOSIT_CATEGORY)
    .eq("kind", "fee")
    .eq("status", "completed");
  if (error) throw new Error("Deposit could not be loaded.");
  for (const payment of data || []) totals.set(payment.student_id, (totals.get(payment.student_id) || 0) + Number(payment.amount_cents || 0));
  return totals;
}

export async function studentCarnegieLinks(students) {
  const links = await ensureSponsorStudentLinks(students.map((student) => ({ id: student.id })));
  return new Map(links.map(({ student, link }) => [student.id, link.active ? link.code : null]));
}

export async function studentLinkCode(studentId) {
  const { data } = await supabaseAdmin
    .from("sponsor_student_links")
    .select("code, active")
    .eq("portal_student_id", studentId)
    .maybeSingle();
  return data?.active ? data.code : null;
}

export async function lettersForStudents(studentIds) {
  if (!studentIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from("carnegie_student_letters")
    .select(LETTER_FIELDS)
    .in("portal_student_id", studentIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Letters could not be loaded.");
  return data || [];
}

export async function familyDashboard(personId) {
  const viewer = await portalViewer(personId);
  // trustedStudentIds admits a student person only for their own high-assurance student link.
  const students = await familyStudents(personId);
  const ids = students.map((student) => student.id);
  const isStudent = viewer === "student";
  const [notes, deposits, codes, letters, reports, expected] = await Promise.all([
    confirmedNotesCents(ids),
    isStudent ? new Map() : depositPaidCents(ids),
    studentCarnegieLinks(students),
    lettersForStudents(ids),
    // Students may report cash or checks they collected (director, 2026-09-24), so they see
    // their own reports and pending amounts too. The deposit stays family-only.
    reportsForStudents(ids),
    expectedForStudents(ids)
  ]);
  const corrections = await approvedCorrections(letters);
  return {
    viewer,
    students: students.map((student) => {
      const code = codes.get(student.id);
      const studentReports = reports.filter((report) => report.portal_student_id === student.id);
      return {
        ...student,
        // Only confirmed gifts count. Reported gifts waiting for staff show separately as pending.
        notesCents: notes.get(student.id) || 0,
        // Expected gifts staff recorded (#110) are pending in the same way. Amount only.
        pendingCents: pendingReportedCents(studentReports) + pendingExpectedCents(expected.filter((item) => item.portal_student_id === student.id)),
        reportedGifts: studentReports,
        depositPaidCents: isStudent ? null : deposits.get(student.id) || 0,
        link: code ? { path: carnegieStudentPath(code), readable: carnegieStudentReadableUrl(code) } : null,
        letters: letters.filter((letter) => letter.portal_student_id === student.id).map((letter) => withPrinted(letter, corrections))
      };
    })
  };
}

// ---- Corrections (#108) ----------------------------------------------------------------------
const CORRECTION_FIELDS = "id, letter_id, letter_version, meaning_text, help_text, note, source, proposed_by, status, reviewed_by_staff_id, reviewed_at, created_at";

export async function approvedCorrections(letters) {
  const ids = letters.map((letter) => letter.approved_correction_id).filter(Boolean);
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin.from("carnegie_letter_corrections").select(CORRECTION_FIELDS).in("id", ids);
  if (error) throw new Error("Corrections could not be loaded.");
  return new Map((data || []).map((row) => [row.id, row]));
}

// Adds the words that print (the accepted correction, or the original) without touching the original.
export function withPrinted(letter, corrections) {
  const printed = printedWords(letter, corrections.get(letter.approved_correction_id));
  return { ...letter, printed_meaning_text: printed.meaning_text, printed_help_text: printed.help_text, corrected: printed.corrected };
}

export async function letterWithPrinted(letter) {
  return withPrinted(letter, await approvedCorrections([letter]));
}

export async function correctionsForLetters(letterIds) {
  if (!letterIds.length) return [];
  const { data, error } = await supabaseAdmin.from("carnegie_letter_corrections").select(CORRECTION_FIELDS).in("letter_id", letterIds).order("created_at", { ascending: false });
  if (error) throw new Error("Corrections could not be loaded.");
  return data || [];
}

export async function suggestStaffCorrection(staff, letter, body) {
  let correction;
  try {
    correction = validateCorrection(letter, { ...body, letter_version: body?.version });
  } catch (error) {
    return { status: 400, error: error.message };
  }
  const { data, error } = await supabaseAdmin
    .from("carnegie_letter_corrections")
    .insert({ letter_id: letter.id, ...correction, source: "staff", proposed_by: `staff:${staff.id}` })
    .select(CORRECTION_FIELDS)
    .single();
  if (error) return { status: 500, error: "The correction could not be saved." };
  return { status: 201, correction: data, letter };
}

export async function dismissCorrection(staff, letter, body) {
  const { data, error } = await supabaseAdmin
    .from("carnegie_letter_corrections")
    .update({ status: "dismissed", reviewed_by_staff_id: staff.id, reviewed_at: new Date().toISOString() })
    .eq("id", String(body?.correction_id || ""))
    .eq("letter_id", letter.id)
    .eq("status", "suggested")
    .select(CORRECTION_FIELDS)
    .maybeSingle();
  if (error) return { status: 400, error: "The correction could not be updated." };
  if (!data) return { status: 409, error: "That correction was already reviewed." };
  return { status: 200, correction: data, letter };
}

async function approveWithCorrection(staff, letter, correctionId) {
  const { error } = await supabaseAdmin.rpc("approve_carnegie_letter_with_correction", {
    p_letter: letter.id, p_version: letter.version, p_correction: correctionId, p_staff: staff.id
  });
  if (error) return { status: 409, error: "This letter or correction changed since you opened it. Reload and review again." };
  return { status: 200, letter: await loadLetterById(letter.id) };
}

// A letter the signed-in adult may see: its student must be one of theirs.
export async function loadFamilyLetter(personId, letterId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(letterId || ""))) return null;
  const { data, error } = await supabaseAdmin.from("carnegie_student_letters").select(LETTER_FIELDS).eq("id", letterId).maybeSingle();
  if (error || !data) return null;
  const allowed = await trustedStudentIds(personId);
  return allowed.includes(data.portal_student_id) ? data : null;
}

export async function loadLetterById(letterId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(letterId || ""))) return null;
  const { data, error } = await supabaseAdmin.from("carnegie_student_letters").select(LETTER_FIELDS).eq("id", letterId).maybeSingle();
  if (error) throw new Error("The letter could not be loaded.");
  return data || null;
}

export async function createFamilyLetter(personId, body, viewer = "family") {
  const studentId = String(body?.student_id || "");
  const allowed = await trustedStudentIds(personId);
  if (!allowed.includes(studentId)) return { status: 404, error: "Student not found." };
  let content;
  try {
    content = validateLetterContent(body);
  } catch (error) {
    return { status: 400, error: error.message };
  }
  const { data, error } = await supabaseAdmin
    .from("carnegie_student_letters")
    .insert({
      ...content,
      portal_student_id: studentId,
      template_version: LETTER_TEMPLATE_VERSION,
      created_by_person_id: personId,
      last_actor_type: viewer,
      last_actor_id: String(personId)
    })
    .select(LETTER_FIELDS)
    .single();
  if (error) return { status: 500, error: "The letter could not be saved." };
  return { status: 201, letter: data };
}

// Optimistic update: the row must still be at the version and status the caller saw.
async function conditionalUpdate(letter, patch) {
  const { data, error } = await supabaseAdmin
    .from("carnegie_student_letters")
    .update(patch)
    .eq("id", letter.id)
    .eq("version", letter.version)
    .eq("status", letter.status)
    .select(LETTER_FIELDS)
    .maybeSingle();
  if (error) return { status: 400, error: "The letter could not be updated." };
  if (!data) return { status: 409, error: "This letter changed since you opened it. Reload to see the latest version." };
  return { status: 200, letter: data };
}

// Family actions: save (edit words), submit, mark_printed, report_delivery.
export async function updateFamilyLetter(personId, letter, body, viewer = "family") {
  const expected = Number(body?.version);
  if (!Number.isInteger(expected) || expected !== letter.version) {
    return { status: 409, error: "This letter changed since you opened it. Reload to see the latest version." };
  }
  const action = String(body?.action || "");
  const actor = { last_actor_type: viewer, last_actor_id: String(personId) };
  try {
    if (action === "save" || action === "submit") {
      const content = validateLetterContent({ recipient_type: letter.recipient_type, ...body }, { requireComplete: action === "submit" });
      const changed = letterContentChanged(letter, content);
      // The optional recipient email only prefills the family's own mail app; it is not letter
      // content and does not need review. A delivered letter stays as it is.
      const emailChanged = content.recipient_email !== (letter.recipient_email || "");
      if (emailChanged && letter.status === "delivery_reported") throw new Error("This letter was delivered and can no longer change.");
      let status = changed ? statusAfterEdit(letter.status) : letter.status;
      const patch = { ...actor, ...content };
      if (action === "submit") {
        status = nextLetterStatus(status, "submit", "family");
        patch.submitted_at = new Date().toISOString();
        patch.review_note = "";
      }
      if (!changed && !emailChanged && status === letter.status) return { status: 200, letter };
      patch.status = status;
      return conditionalUpdate(letter, patch);
    }
    if (action === "mark_printed") {
      return conditionalUpdate(letter, { ...actor, status: nextLetterStatus(letter.status, action, "family"), printed_at: new Date().toISOString() });
    }
    if (action === "report_delivery") {
      const channel = deliveryChannel(body.channel);
      if (!channel) return { status: 400, error: "Choose how you sent it: paper, email or text." };
      return conditionalUpdate(letter, { ...actor, status: nextLetterStatus(letter.status, action, "family"), delivery_reported_at: new Date().toISOString(), delivery_channel: channel });
    }
    return { status: 400, error: "Unknown letter action." };
  } catch (error) {
    return { status: 400, error: error.message };
  }
}

// Staff actions: approve (exact version), return_to_draft (with a note), mark_printed, report_delivery.
export async function updateStaffLetter(staff, letter, body) {
  const expected = Number(body?.version);
  if (!Number.isInteger(expected) || expected !== letter.version) {
    return { status: 409, error: "This letter changed since you opened it. Reload to review the latest version." };
  }
  const action = String(body?.action || "");
  const actor = { last_actor_type: "staff", last_actor_id: String(staff.id) };
  if (action === "suggest_correction") return suggestStaffCorrection(staff, letter, body);
  if (action === "dismiss_correction") return dismissCorrection(staff, letter, body);
  try {
    const status = nextLetterStatus(letter.status, action, "staff");
    const now = new Date().toISOString();
    if (action === "approve" && body?.correction_id) return approveWithCorrection(staff, letter, String(body.correction_id));
    if (action === "approve") {
      return conditionalUpdate(letter, { ...actor, status, approved_version: letter.version, approved_at: now, approved_by_staff_id: staff.id, review_note: "" });
    }
    if (action === "return_to_draft") {
      const note = typeof body?.note === "string" ? body.note.slice(0, 1000) : "";
      if (!note.trim()) return { status: 400, error: "Add a short note so the family knows what to change." };
      return conditionalUpdate(letter, { ...actor, status, review_note: note });
    }
    if (action === "mark_printed") return conditionalUpdate(letter, { ...actor, status, printed_at: now });
    if (action === "report_delivery") return conditionalUpdate(letter, { ...actor, status, delivery_reported_at: now, delivery_channel: deliveryChannel(body?.channel) || "paper" });
    return { status: 400, error: "Unknown letter action." };
  } catch (error) {
    return { status: 400, error: error.message };
  }
}

export async function staffLetterQueue() {
  const { data, error } = await supabaseAdmin
    .from("carnegie_student_letters")
    .select(`${LETTER_FIELDS}, portal_students(display_name, preferred_first, legal_first)`)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Letters could not be loaded.");
  const rows = data || [];
  const codes = new Map();
  const ids = [...new Set(rows.map((row) => row.portal_student_id))];
  if (ids.length) {
    const { data: links } = await supabaseAdmin.from("sponsor_student_links").select("portal_student_id, code, active").in("portal_student_id", ids);
    for (const link of links || []) if (link.active) codes.set(link.portal_student_id, link.code);
  }
  const corrections = await correctionsForLetters(rows.map((row) => row.id));
  const accepted = new Map(corrections.filter((c) => c.status === "accepted").map((c) => [c.id, c]));
  return rows.map(({ portal_students: student, ...letter }) => ({
    ...withPrinted(letter, accepted),
    corrections: corrections.filter((c) => c.letter_id === letter.id && c.letter_version === letter.version),
    student: {
      displayName: student?.display_name || "Band student",
      firstName: studentFirstName(student?.preferred_first || student?.legal_first || student?.display_name) || "Band student"
    },
    code: codes.get(letter.portal_student_id) || null
  }));
}

export async function studentForLetter(letter) {
  const [student] = await activeStudents([letter.portal_student_id]);
  return student || null;
}

// ---- Student-reported offline gifts ---------------------------------------------------------
// Unverified reports live only in carnegie_reported_gifts. No total reads this table; a gift
// exists only after staff confirm, through the same #103 offline path (createPendingGift then
// confirmGift) with the report id as the idempotency key, so one report makes at most one gift.
const REPORT_FIELDS = "id, portal_student_id, reported_by_type, donor_name, donor_email, reported_amount_cents, reported_method, check_number, note, status, confirmed_amount_cents, confirmed_method, sponsor_gift_id, reject_reason, reviewed_at, created_at";

export async function reportsForStudents(studentIds) {
  if (!studentIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from("carnegie_reported_gifts")
    .select(REPORT_FIELDS)
    .in("portal_student_id", studentIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Reported gifts could not be loaded.");
  return data || [];
}

export async function createReportedGift(personId, body) {
  // Families and students may both report (director, 2026-09-24); the report records which.
  const reporterType = await portalViewer(personId);
  const studentId = String(body?.student_id || "");
  const allowed = await trustedStudentIds(personId);
  if (!allowed.includes(studentId)) return { status: 404, error: "Student not found." };
  let report;
  try {
    report = validateReportedGift(body);
  } catch (error) {
    return { status: 400, error: error.message };
  }
  const { data, error } = await supabaseAdmin
    .from("carnegie_reported_gifts")
    .insert({ ...report, portal_student_id: studentId, reported_by_person_id: personId, reported_by_type: reporterType })
    .select(REPORT_FIELDS)
    .single();
  if (error) return { status: 500, error: "The gift report could not be saved." };
  return { status: 201, report: data };
}

export async function staffReportedGiftQueue() {
  const { data, error } = await supabaseAdmin
    .from("carnegie_reported_gifts")
    .select(`${REPORT_FIELDS}, portal_students(display_name)`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Reported gifts could not be loaded.");
  return (data || []).map(({ portal_students: student, ...report }) => ({ ...report, student: { displayName: student?.display_name || "Band student" } }));
}

export async function loadReportedGift(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const { data, error } = await supabaseAdmin.from("carnegie_reported_gifts").select(REPORT_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new Error("The report could not be loaded.");
  return data || null;
}

function dollarsText(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

export async function confirmReportedGift(staff, report, body, origin) {
  if (report.status === "confirmed") return { status: 200, report, alreadyConfirmed: true };
  let confirmation;
  try {
    confirmation = confirmationFromReview(report, body);
  } catch (error) {
    return { status: report.status === "rejected" ? 409 : 400, error: error.message };
  }
  const staffName = staff.display_name || "staff";
  await logAuditRequired({
    actor: staffActor(staff),
    action: "reported_gift_confirm_requested",
    table: "carnegie_reported_gifts",
    recordId: report.id,
    route: "/api/admin/carnegie-reported-gifts/[id]",
    changes: { reported_amount_cents: report.reported_amount_cents, confirmed_amount_cents: confirmation.amountCents, reported_method: report.reported_method, confirmed_method: confirmation.method }
  });
  const created = await createPendingGift({
    amountCents: confirmation.amountCents,
    method: confirmation.method,
    requestKey: report.id,
    attributionToken: null,
    businessName: report.donor_name,
    payerName: report.donor_name,
    payerEmail: report.donor_email,
    recordedBy: `staff:${staffName}`,
    campaignCode: CARNEGIE_CAMPAIGN,
    giftKind: "donation",
    termsVersion: null,
    staffStudentId: report.portal_student_id,
    notes: `Student-reported ${confirmation.method} confirmed by ${staffName} (report ${report.id}). Reported ${dollarsText(report.reported_amount_cents)} ${report.reported_method}; confirmed ${dollarsText(confirmation.amountCents)} ${confirmation.method}.${report.check_number ? ` Check ${report.check_number}.` : ""}`
  });
  if (created.error) return { status: created.status || 400, error: created.error };
  await confirmGift(created.gift.id, { confirmedBy: staffName, origin, listOnSite: false });
  const { data, error } = await supabaseAdmin
    .from("carnegie_reported_gifts")
    .update({
      status: "confirmed",
      confirmed_amount_cents: confirmation.amountCents,
      confirmed_method: confirmation.method,
      sponsor_gift_id: created.gift.id,
      reviewed_by_staff_id: staff.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", report.id)
    .eq("status", "reported")
    .select(REPORT_FIELDS)
    .maybeSingle();
  if (error) return { status: 500, error: "The gift was confirmed but the report could not be closed. Reload and try again." };
  if (!data) return { status: 200, report: await loadReportedGift(report.id), alreadyConfirmed: true };
  return { status: 200, report: data, giftId: created.gift.id };
}

export async function rejectReportedGift(staff, report, body) {
  if (report.status !== "reported") return { status: 409, error: "This report was already reviewed." };
  let reason;
  try {
    reason = rejectionReason(body);
  } catch (error) {
    return { status: 400, error: error.message };
  }
  const { data, error } = await supabaseAdmin
    .from("carnegie_reported_gifts")
    .update({ status: "rejected", reject_reason: reason, reviewed_by_staff_id: staff.id, reviewed_at: new Date().toISOString() })
    .eq("id", report.id)
    .eq("status", "reported")
    .select(REPORT_FIELDS)
    .maybeSingle();
  if (error) return { status: 500, error: "The report could not be updated." };
  if (!data) return { status: 409, error: "This report was already reviewed." };
  return { status: 200, report: data };
}

// Letter reviewers (#106): any staff role holding carnegie.letters.review. The letter queue is one
// program-wide review list, not per-student records, so assigned-scope roles (treasurer, event
// worker) review it too; that is the director's 2026-09-24 decision. Nothing else is unlocked.
export async function authorizeLetterReviewer(requestLike) {
  return authorizeStaffRequest(requestLike, STAFF_CAPABILITIES.CARNEGIE_LETTERS_REVIEW, { safeCapabilityOnly: true });
}

// ---- Staff-recorded expected gifts (#110) ---------------------------------------------------
// Pending promises in carnegie_expected_gifts. No total reads this table. Confirming goes through
// the #103 offline path with the expected id as the idempotency key: one item, at most one gift.
const EXPECTED_FIELDS = "id, portal_student_id, donor_name, donor_email, amount_cents, method, platform, gift_type, gift_date, expected_date, designation, note, status, confirmed_amount_cents, confirmed_method, sponsor_gift_id, cancel_reason, entered_by, reviewed_at, source, created_at";

export async function expectedForStudents(studentIds) {
  if (!studentIds.length) return [];
  const { data, error } = await supabaseAdmin.from("carnegie_expected_gifts").select("portal_student_id, amount_cents, status").in("portal_student_id", studentIds).eq("status", "expected");
  if (error) throw new Error("Expected gifts could not be loaded.");
  return data || [];
}

export async function staffExpectedGifts() {
  const { data, error } = await supabaseAdmin.from("carnegie_expected_gifts").select(`${EXPECTED_FIELDS}, portal_students(display_name)`).order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error("Expected gifts could not be loaded.");
  return (data || []).map(({ portal_students: student, ...item }) => ({ ...item, student: student ? { displayName: student.display_name } : null }));
}

export async function createExpectedGift(staff, body) {
  let item;
  try {
    item = validateExpectedGift(body);
  } catch (error) {
    return { status: 400, error: error.message };
  }
  if (item.portal_student_id) {
    const { data: student } = await supabaseAdmin.from("portal_students").select("id").eq("id", item.portal_student_id).eq("status", "active").maybeSingle();
    if (!student) return { status: 400, error: "Choose an active student from the list." };
  }
  const { data, error } = await supabaseAdmin.from("carnegie_expected_gifts")
    .insert({ ...item, entered_by: `staff:${staff.id}`, source: "staff" })
    .select(EXPECTED_FIELDS).single();
  if (error) return { status: 500, error: "The expected gift could not be saved." };
  return { status: 201, item: data };
}

export async function loadExpectedGift(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const { data, error } = await supabaseAdmin.from("carnegie_expected_gifts").select(EXPECTED_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new Error("The expected gift could not be loaded.");
  return data || null;
}

export async function confirmExpectedGift(staff, item, body, origin) {
  if (item.status === "confirmed") return { status: 200, item, alreadyConfirmed: true };
  let confirmation;
  try {
    confirmation = expectedConfirmation(item, body);
  } catch (error) {
    return { status: 409, error: error.message };
  }
  const staffName = staff.display_name || "staff";
  await logAuditRequired({
    actor: staffActor(staff), action: "expected_gift_confirm_requested", table: "carnegie_expected_gifts", recordId: item.id,
    route: "/api/admin/carnegie-expected-gifts/[id]",
    changes: { amount_cents: item.amount_cents, confirmed_amount_cents: confirmation.amountCents, method: item.method, confirmed_method: confirmation.method }
  });
  const created = await createPendingGift({
    amountCents: confirmation.amountCents,
    method: sponsorGiftMethod(confirmation.method),
    requestKey: item.id,
    attributionToken: null,
    businessName: item.donor_name,
    payerName: item.donor_name,
    payerEmail: item.donor_email,
    recordedBy: `staff:${staffName}`,
    campaignCode: CARNEGIE_CAMPAIGN,
    giftKind: "donation",
    termsVersion: null,
    staffStudentId: item.portal_student_id,
    notes: `Expected ${item.gift_type.replace("_", " ")} confirmed by ${staffName} (expected gift ${item.id}). ${confirmation.method === "employer_platform" ? `Employer giving platform${item.platform ? ` (${item.platform})` : ""}. ` : ""}Expected $${(item.amount_cents / 100).toFixed(2)}; confirmed $${(confirmation.amountCents / 100).toFixed(2)}.${item.designation ? ` Designation: ${item.designation}` : ""}`.slice(0, 1000)
  });
  if (created.error) return { status: created.status || 400, error: created.error };
  await confirmGift(created.gift.id, { confirmedBy: staffName, origin, listOnSite: false });
  const { data, error } = await supabaseAdmin.from("carnegie_expected_gifts")
    .update({ status: "confirmed", confirmed_amount_cents: confirmation.amountCents, confirmed_method: confirmation.method, sponsor_gift_id: created.gift.id, reviewed_by_staff_id: staff.id, reviewed_at: new Date().toISOString() })
    .eq("id", item.id).eq("status", "expected").select(EXPECTED_FIELDS).maybeSingle();
  if (error) return { status: 500, error: "The gift was confirmed but the expected item could not be closed. Reload and try again." };
  if (!data) return { status: 200, item: await loadExpectedGift(item.id), alreadyConfirmed: true };
  return { status: 200, item: data };
}

export async function cancelExpectedGift(staff, item, body) {
  if (item.status !== "expected") return { status: 409, error: "This expected gift was already confirmed or cancelled." };
  let reason;
  try {
    reason = rejectionReason(body);
  } catch (error) {
    return { status: 400, error: error.message };
  }
  const { data, error } = await supabaseAdmin.from("carnegie_expected_gifts")
    .update({ status: "cancelled", cancel_reason: reason, reviewed_by_staff_id: staff.id, reviewed_at: new Date().toISOString() })
    .eq("id", item.id).eq("status", "expected").select(EXPECTED_FIELDS).maybeSingle();
  if (error) return { status: 500, error: "The expected gift could not be updated." };
  if (!data) return { status: 409, error: "This expected gift was already confirmed or cancelled." };
  return { status: 200, item: data };
}
