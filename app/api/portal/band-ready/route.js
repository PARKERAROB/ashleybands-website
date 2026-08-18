import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { sendBandReadySummaryEmail } from "@/lib/portalEmail";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

const VALID = {
  instrumentStatus: new Set(["personal", "county", "help"]),
  supplyStatus: new Set(["have", "need"]),
  clothingStatus: new Set(["ordered", "not_ordering", "return_later"])
};

const PORTAL_URL = "https://ashleybands.com/portal/band-ready";

function oneRelation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function manyRelation(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeStep(step, data) {
  if (step === "calendar") return { confirmed: data?.confirmed === true, confirmedAt: data?.confirmed === true ? new Date().toISOString() : null };
  if (step === "day-one") {
    const instrumentStatus = String(data?.instrumentStatus || "");
    const binderStatus = String(data?.binderStatus || "");
    const pencilStatus = String(data?.pencilStatus || "");
    const pencilName = String(data?.pencilName || "").trim().slice(0, 80);
    if (!VALID.instrumentStatus.has(instrumentStatus) || !VALID.supplyStatus.has(binderStatus) || !VALID.supplyStatus.has(pencilStatus)) {
      throw new Error("Choose an answer for the instrument, binder, and band pencil.");
    }
    if (pencilStatus === "have" && !pencilName) throw new Error("Give the dedicated band pencil a name.");
    return { instrumentStatus, binderStatus, pencilStatus, pencilName, confirmedAt: new Date().toISOString() };
  }
  if (step === "how-band-works") return { acknowledged: data?.acknowledged === true, confirmedAt: data?.acknowledged === true ? new Date().toISOString() : null };
  if (step === "clothing") {
    const status = String(data?.status || "");
    if (!VALID.clothingStatus.has(status)) throw new Error("Choose what you plan to do about the clothing collection.");
    return { status, confirmedAt: new Date().toISOString() };
  }
  throw new Error("Unknown Band Ready step.");
}

function readiness(progress, external) {
  const dayOne = progress?.["day-one"] || {};
  const complete = {
    portal: true,
    calendar: progress?.calendar?.confirmed === true,
    "day-one": VALID.instrumentStatus.has(dayOne.instrumentStatus) && VALID.supplyStatus.has(dayOne.binderStatus) && VALID.supplyStatus.has(dayOne.pencilStatus) && (dayOne.pencilStatus !== "have" || Boolean(dayOne.pencilName)),
    forms: dayOne.instrumentStatus === "personal" || dayOne.instrumentStatus === "help" || (dayOne.instrumentStatus === "county" && Boolean(external.instrumentRequest)),
    "how-band-works": progress?.["how-band-works"]?.acknowledged === true,
    clothing: progress?.clothing?.status === "ordered" || progress?.clothing?.status === "not_ordering" || progress?.clothing?.status === "return_later" || external.clothingOrder?.payment_status === "paid"
  };
  return { complete, count: Object.values(complete).filter(Boolean).length, finished: Object.values(complete).every(Boolean) };
}

async function loadState(personId, studentId) {
  const { data: links, error } = await supabaseAdmin
    .from("portal_student_people")
    .select(`
      student_id,
      portal_students(
        id,
        display_name,
        school_email,
        portal_band_ready_progress(
          id,
          progress,
          completed_at,
          summary_email_sent_at,
          summary_email_recipients,
          summary_email_error,
          updated_at
        ),
        portal_instrument_requests(id, status, submitted_at, school_year),
        portal_clothing_orders(id, payment_status, submitted_at)
      )
    `)
    .eq("person_id", personId)
    .eq("relationship_status", "trusted");
  if (error) throw error;

  const linkedStudents = (links || []).map((link) => oneRelation(link.portal_students)).filter(Boolean);
  const students = linkedStudents.map((student) => ({ id: student.id, displayName: student.display_name }));
  const selected = linkedStudents.find((student) => student.id === studentId) || linkedStudents[0] || null;
  if (!selected) return { students, student: null };

  const row = oneRelation(selected.portal_band_ready_progress);
  const instrumentRequest = manyRelation(selected.portal_instrument_requests)
    .filter((item) => item.school_year === "2026-2027")
    .sort((left, right) => String(right.submitted_at || "").localeCompare(String(left.submitted_at || "")))[0] || null;
  const clothingOrder = manyRelation(selected.portal_clothing_orders)
    .sort((left, right) => String(right.submitted_at || "").localeCompare(String(left.submitted_at || "")))[0] || null;
  const external = { instrumentRequest, clothingOrder };
  const progress = { ...(row?.progress || {}) };
  if (external.clothingOrder?.payment_status === "paid" && progress?.clothing?.status !== "ordered") {
    progress.clothing = { status: "ordered", confirmedAt: external.clothingOrder.submitted_at };
  }
  const student = { id: selected.id, display_name: selected.display_name, school_email: selected.school_email };
  return { students, student, row: row || null, progress, external, readiness: readiness(progress, external) };
}

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const studentId = new URL(request.url).searchParams.get("studentId") || "";
  let state;
  try { state = await loadState(session.personId, studentId); }
  catch { return NextResponse.json({ error: "Band Ready could not be loaded." }, { status: 500 }); }
  if (!state.student) return NextResponse.json({ error: "No student is connected to this family profile." }, { status: 404 });
  return NextResponse.json({
    students: state.students,
    student: state.student,
    progress: state.progress,
    external: state.external,
    readiness: state.readiness,
    completion: state.row ? {
      completedAt: state.row.completed_at,
      emailSentAt: state.row.summary_email_sent_at,
      emailRecipients: state.row.summary_email_recipients,
      emailError: state.row.summary_email_error,
      updatedAt: state.row.updated_at
    } : null
  });
}

export async function PATCH(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  const step = String(body.step || "");
  let state;
  try { state = await loadState(session.personId, studentId); }
  catch { return NextResponse.json({ error: "Band Ready could not be loaded." }, { status: 500 }); }
  if (!state.student || state.student.id !== studentId) return NextResponse.json({ error: "Student access not found." }, { status: 403 });
  let value;
  try { value = normalizeStep(step, body.data || {}); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  const progress = { ...state.progress, [step]: value };
  const { error } = await supabaseAdmin.from("portal_band_ready_progress").upsert({
    student_id: studentId,
    last_updated_by_person_id: session.personId,
    progress,
    completed_at: null,
    summary_email_sent_at: null,
    summary_email_recipients: [],
    summary_email_error: null,
    updated_at: new Date().toISOString()
  }, { onConflict: "student_id" });
  if (error) return NextResponse.json({ error: "Could not save Band Ready progress." }, { status: 500 });
  await logAudit({ actor: { type: "parent", id: session.personId, name: session.email }, action: "update", table: "portal_band_ready_progress", recordId: studentId, route: "/api/portal/band-ready", changes: { step, value } });
  return NextResponse.json({ ok: true, progress, readiness: readiness(progress, state.external) });
}

function summaryItems(state) {
  const dayOne = state.progress?.["day-one"] || {};
  const completed = [
    "Family Portal access is connected",
    "Band calendar subscription was confirmed",
    "Band expectations and communication were reviewed",
    dayOne.instrumentStatus === "personal" ? "Personal instrument is ready" : dayOne.instrumentStatus === "county" ? "County instrument path selected" : "Instrument help was requested",
    dayOne.binderStatus === "have" ? "Black one-inch band binder is ready" : null,
    dayOne.pencilStatus === "have" ? `Dedicated band pencil is ready${dayOne.pencilName ? `. Its name is ${dayOne.pencilName}` : ""}` : null,
    state.external.instrumentRequest ? "County instrument responsibility agreement was submitted" : null,
    state.external.clothingOrder?.payment_status === "paid" ? "Open House clothing order was paid" : null
  ].filter(Boolean);
  const stillNeeded = [
    dayOne.binderStatus === "need" ? "Get a black one-inch binder" : null,
    dayOne.pencilStatus === "need" ? "Get and name a dedicated band pencil" : null,
    dayOne.instrumentStatus === "county" && !state.external.instrumentRequest ? "Complete the county instrument responsibility agreement" : null,
    dayOne.instrumentStatus === "help" ? "Follow up with Mr. Parker about the student’s instrument" : null,
    state.progress?.clothing?.status === "return_later" ? "Return to the clothing collection by the order deadline" : null
  ].filter(Boolean);
  const followUp = [
    state.progress?.clothing?.status === "not_ordering" ? "No Open House clothing order planned" : null,
    state.progress?.clothing?.status === "ordered" || state.external.clothingOrder?.payment_status === "paid" ? "Clothing collection reviewed" : null
  ].filter(Boolean);
  return { completed, stillNeeded, followUp };
}

async function recipientsFor(state, sessionEmail) {
  const { data: links } = await supabaseAdmin
    .from("portal_student_people")
    .select("portal_people(id, person_type)")
    .eq("student_id", state.student.id)
    .eq("relationship_status", "trusted");
  const personIds = (links || []).map((link) => link.portal_people?.id).filter(Boolean);
  const { data: contacts } = personIds.length ? await supabaseAdmin
    .from("portal_contact_methods")
    .select("value_normalized, verification_status")
    .in("person_id", personIds)
    .eq("contact_type", "email")
    .not("verification_status", "in", "(hard_bounce,replaced,superseded)") : { data: [] };
  return [...new Set([sessionEmail, state.student.school_email, ...(contacts || []).map((item) => item.value_normalized)].map((value) => String(value || "").trim().toLowerCase()).filter((value) => value.includes("@")))];
}

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  let state;
  try { state = await loadState(session.personId, studentId); }
  catch { return NextResponse.json({ error: "Band Ready could not be loaded." }, { status: 500 }); }
  if (!state.student || state.student.id !== studentId) return NextResponse.json({ error: "Student access not found." }, { status: 403 });
  if (!state.readiness.finished) return NextResponse.json({ error: "Complete each Band Ready step before finishing." }, { status: 409 });
  if (state.row?.summary_email_sent_at) return NextResponse.json({ ok: true, alreadySent: true, recipients: state.row.summary_email_recipients || [] });
  const recipients = await recipientsFor(state, session.email);
  const items = summaryItems(state);
  const completedAt = new Date().toISOString();
  let sentAt = null;
  let emailError = null;
  try {
    await sendBandReadySummaryEmail({ to: recipients, studentName: state.student.display_name, ...items, portalUrl: PORTAL_URL });
    sentAt = new Date().toISOString();
  } catch (error) {
    emailError = error.message || "Summary email could not be sent.";
  }
  const { error } = await supabaseAdmin.from("portal_band_ready_progress").upsert({
    student_id: studentId,
    last_updated_by_person_id: session.personId,
    progress: state.progress,
    completed_at: completedAt,
    summary_email_sent_at: sentAt,
    summary_email_recipients: recipients,
    summary_email_error: emailError,
    updated_at: completedAt
  }, { onConflict: "student_id" });
  if (error) return NextResponse.json({ error: "Could not finish Band Ready." }, { status: 500 });
  await logAudit({ actor: { type: "parent", id: session.personId, name: session.email }, action: "complete", table: "portal_band_ready_progress", recordId: studentId, route: "/api/portal/band-ready", changes: { email_sent: Boolean(sentAt), recipient_count: recipients.length, still_needed: items.stillNeeded } });
  return NextResponse.json({ ok: true, emailSent: Boolean(sentAt), emailError, recipients, items, completedAt });
}
