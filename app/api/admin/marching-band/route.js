import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";

export const runtime = "nodejs";

const VALID_STATUSES = new Set([
  "no_response",
  "signed_up",
  "mb_info",
  "band_only",
  "out",
  "talk",
  "needs_clarification"
]);

const STATUS_FROM_ACTION = {
  mb_info: "mb_info",
  band_only: "band_only",
  out: "out",
  talk: "talk"
};

function clean(value) {
  return String(value || "").trim();
}

function key(value) {
  return clean(value).toLowerCase();
}

function stripEmailPrefix(value) {
  return key(value).replace(/^email:/, "");
}

function nameKey(first, last) {
  return key([first, last].filter(Boolean).join(" "));
}

function addKey(map, value, row) {
  const k = stripEmailPrefix(value);
  if (k && !map.has(k)) map.set(k, row);
}

function isTestRow(row) {
  const text = [
    row?.student_id,
    row?.student_name,
    row?.parent_name,
    row?.responder_email
  ].filter(Boolean).join(" ").toLowerCase();
  return /\btest\b/.test(text) || text.startsWith("test-rob-parker");
}

function latestByStudent(rows) {
  const latest = new Map();
  for (const row of rows || []) {
    if (isTestRow(row)) continue;
    const candidates = [
      row.student_id,
      row.student_name,
      row.responder_email
    ].map(stripEmailPrefix).filter(Boolean);
    for (const candidate of candidates) {
      if (!latest.has(candidate)) latest.set(candidate, row);
    }
  }
  return latest;
}

function buildDashboardRows({ portalStudents, recaptures, signups, overrides }) {
  const signupByKey = new Map();
  for (const signup of signups || []) {
    const student = signup.students || {};
    addKey(signupByKey, student.source_student_id, signup);
    addKey(signupByKey, student.student_email, signup);
    addKey(signupByKey, nameKey(student.first_name, student.last_name), signup);
  }

  const recaptureByKey = latestByStudent(recaptures);
  const overrideByStudent = new Map((overrides || []).map((row) => [key(row.source_student_id), row]));
  const matchedSignupIds = new Set();
  const matchedRecaptureIds = new Set();
  const coveredKeys = new Set();

  const rows = (portalStudents || [])
    .filter((student) => student.status !== "inactive-graduated")
    .map((student) => {
      const studentKeys = [
        student.source_student_id,
        student.school_email,
        nameKey(student.legal_first || student.display_name, student.legal_last)
      ].map(stripEmailPrefix).filter(Boolean);
      studentKeys.forEach((studentKey) => coveredKeys.add(studentKey));
      const signup = studentKeys.map((k) => signupByKey.get(k)).find(Boolean) || null;
      const recapture = studentKeys.map((k) => recaptureByKey.get(k)).find(Boolean) || null;
      if (signup) matchedSignupIds.add(signup.id);
      if (recapture) matchedRecaptureIds.add(recapture.id);
      const override = overrideByStudent.get(key(student.source_student_id)) || null;
      const derivedStatus = signup
        ? "signed_up"
        : recapture
          ? STATUS_FROM_ACTION[recapture.action] || "no_response"
          : "no_response";
      const currentStatus = override?.status || derivedStatus;
      const source = override ? "manual" : signup ? "signup" : recapture ? "click" : "none";

      return {
        id: student.id,
        sourceStudentId: student.source_student_id,
        displayName: student.display_name,
        legalFirst: student.legal_first,
        legalLast: student.legal_last,
        preferredFirst: student.preferred_first,
        grade: student.grade_fall26,
        schoolEmail: student.school_email,
        studentStatus: student.status,
        currentStatus,
        derivedStatus,
        source,
        manualNotes: override?.notes || "",
        manualUpdatedAt: override?.updated_at || null,
        manualUpdatedBy: override?.updated_by_name || "",
        latestClick: recapture
          ? {
              action: recapture.action,
              createdAt: recapture.created_at,
              note: recapture.response_note,
              responderEmail: recapture.responder_email,
              parentName: recapture.parent_name
            }
          : null,
        signup: signup
          ? {
              submittedAt: signup.submitted_at,
              fundingPath: signup.funding_path,
              knownConflicts: signup.known_conflicts,
              questions: signup.questions,
              instrument: signup.students?.instrument,
              guardianName: signup.guardians?.full_name,
              guardianEmail: signup.guardians?.email,
              guardianPhone: signup.guardians?.phone
            }
          : null
      };
    });

  for (const signup of signups || []) {
    if (matchedSignupIds.has(signup.id)) continue;
    const student = signup.students || {};
    const sourceStudentId = stripEmailPrefix(student.source_student_id) || stripEmailPrefix(student.student_email) || nameKey(student.first_name, student.last_name);
    if (coveredKeys.has(sourceStudentId)) continue;
    coveredKeys.add(sourceStudentId);
    [
      student.source_student_id,
      student.student_email,
      nameKey(student.first_name, student.last_name)
    ].map(stripEmailPrefix).filter(Boolean).forEach((signupKey) => coveredKeys.add(signupKey));
    const override = overrideByStudent.get(key(sourceStudentId)) || null;
    rows.push({
      id: `signup:${signup.id}`,
      sourceStudentId,
      displayName: [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || sourceStudentId,
      legalFirst: student.first_name,
      legalLast: student.last_name,
      preferredFirst: null,
      grade: student.grade_fall,
      schoolEmail: student.student_email,
      studentStatus: "signup_only",
      currentStatus: override?.status || "signed_up",
      derivedStatus: "signed_up",
      source: override ? "manual" : "signup",
      manualNotes: override?.notes || "",
      manualUpdatedAt: override?.updated_at || null,
      manualUpdatedBy: override?.updated_by_name || "",
      latestClick: null,
      signup: {
        submittedAt: signup.submitted_at,
        fundingPath: signup.funding_path,
        knownConflicts: signup.known_conflicts,
        questions: signup.questions,
        instrument: student.instrument,
        guardianName: signup.guardians?.full_name,
        guardianEmail: signup.guardians?.email,
        guardianPhone: signup.guardians?.phone
      }
    });
  }

  for (const recapture of recaptures || []) {
    if (isTestRow(recapture)) continue;
    if (matchedRecaptureIds.has(recapture.id)) continue;
    const sourceStudentId = stripEmailPrefix(recapture.student_id) || key(recapture.student_name);
    if (!sourceStudentId) continue;
    const recaptureKeys = [
      sourceStudentId,
      key(recapture.student_name),
      stripEmailPrefix(recapture.responder_email)
    ].filter(Boolean);
    if (recaptureKeys.some((recaptureKey) => coveredKeys.has(recaptureKey))) continue;
    recaptureKeys.forEach((recaptureKey) => coveredKeys.add(recaptureKey));
    const override = overrideByStudent.get(key(sourceStudentId)) || null;
    rows.push({
      id: `click:${recapture.id}`,
      sourceStudentId,
      displayName: recapture.student_name || sourceStudentId,
      legalFirst: null,
      legalLast: null,
      preferredFirst: null,
      grade: null,
      schoolEmail: recapture.student_id && recapture.student_id.includes("@") ? recapture.student_id : "",
      studentStatus: "click_only",
      currentStatus: override?.status || STATUS_FROM_ACTION[recapture.action] || "no_response",
      derivedStatus: STATUS_FROM_ACTION[recapture.action] || "no_response",
      source: override ? "manual" : "click",
      manualNotes: override?.notes || "",
      manualUpdatedAt: override?.updated_at || null,
      manualUpdatedBy: override?.updated_by_name || "",
      latestClick: {
        action: recapture.action,
        createdAt: recapture.created_at,
        note: recapture.response_note,
        responderEmail: recapture.responder_email,
        parentName: recapture.parent_name
      },
      signup: null
    });
  }

  rows.sort((a, b) => {
      const statusSort = a.currentStatus.localeCompare(b.currentStatus);
      if (statusSort) return statusSort;
      return a.displayName.localeCompare(b.displayName);
    });

  const totals = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.currentStatus] = (acc[row.currentStatus] || 0) + 1;
    if (row.source === "manual") acc.manual += 1;
    return acc;
  }, {
    total: 0,
    signed_up: 0,
    mb_info: 0,
    band_only: 0,
    out: 0,
    talk: 0,
    needs_clarification: 0,
    no_response: 0,
    manual: 0
  });

  return { rows, totals };
}

async function loadOverrides() {
  const { data, error } = await supabaseAdmin
    .from("marching_band_status_overrides_2026")
    .select("id, source_student_id, status, notes, updated_by_name, updated_at");

  if (error && /marching_band_status_overrides_2026/i.test(error.message || "")) {
    const fallback = await supabaseAdmin
      .from("portal_review_queue")
      .select("id, summary, details, created_at, updated_at")
      .eq("item_type", "profile_conflict")
      .eq("details->>kind", "mb_status_override")
      .order("created_at", { ascending: false })
      .limit(500);

    if (fallback.error) throw fallback.error;
    const byStudent = new Map();
    for (const row of fallback.data || []) {
      const sourceStudentId = key(row.details?.source_student_id);
      if (!sourceStudentId || byStudent.has(sourceStudentId)) continue;
      byStudent.set(sourceStudentId, {
        id: row.id,
        source_student_id: row.details.source_student_id,
        status: row.details.status,
        notes: row.details.notes || "",
        updated_by_name: row.details.updated_by_name || "",
        updated_at: row.updated_at || row.created_at
      });
    }
    return { data: Array.from(byStudent.values()), missing: false, fallback: true };
  }
  if (error) throw error;
  return { data: data || [], missing: false, fallback: false };
}

export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const [
      { data: portalStudents, error: portalError },
      { data: recaptures, error: recaptureError },
      { data: signups, error: signupError },
      overrideResult
    ] = await Promise.all([
      supabaseAdmin
        .from("portal_students")
        .select("id, source_student_id, legal_first, legal_last, preferred_first, display_name, grade_fall26, school_email, status, notes")
        .order("display_name", { ascending: true }),
      supabaseAdmin
        .from("band_recapture_2026")
        .select("id, student_id, student_name, parent_name, action, response_note, responder_email, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("marching_band_signup_2026")
        .select("id, funding_path, known_conflicts, questions, submitted_at, students(source_student_id, first_name, last_name, grade_fall, instrument, student_email), guardians(full_name, email, phone)")
        .order("submitted_at", { ascending: false }),
      loadOverrides()
    ]);

    if (portalError) return NextResponse.json({ error: portalError.message }, { status: 500 });
    if (recaptureError) return NextResponse.json({ error: recaptureError.message }, { status: 500 });
    if (signupError) return NextResponse.json({ error: signupError.message }, { status: 500 });

    const dashboard = buildDashboardRows({
      portalStudents,
      recaptures,
      signups,
      overrides: overrideResult.data
    });

    return NextResponse.json({
      staff: { displayName: staff.display_name, role: staff.role },
      migrationRequired: overrideResult.missing,
      usingFallbackOverrides: overrideResult.fallback,
      ...dashboard
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sourceStudentId = clean(body.sourceStudentId);
  const status = clean(body.status);
  const notes = clean(body.notes).slice(0, 2000);

  if (!sourceStudentId || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Valid student and status are required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("marching_band_status_overrides_2026")
    .upsert({
      source_student_id: sourceStudentId,
      status,
      notes,
      updated_by_staff_id: staff.id,
      updated_by_name: staff.display_name
    }, { onConflict: "source_student_id" })
    .select("id, source_student_id, status, notes, updated_by_name, updated_at")
    .single();

  if (error && /marching_band_status_overrides_2026/i.test(error.message || "")) {
    const now = new Date().toISOString();
    const fallback = await supabaseAdmin
      .from("portal_review_queue")
      .insert({
        item_type: "profile_conflict",
        status: "merged",
        summary: `MB status override: ${sourceStudentId} -> ${status}`,
        details: {
          kind: "mb_status_override",
          source_student_id: sourceStudentId,
          status,
          notes,
          updated_by_staff_id: staff.id,
          updated_by_name: staff.display_name,
          updated_at: now
        },
        email_alert_status: "skipped"
      })
      .select("id, details, updated_at, created_at")
      .single();

    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    return NextResponse.json({
      override: {
        id: fallback.data.id,
        source_student_id: sourceStudentId,
        status,
        notes,
        updated_by_name: staff.display_name,
        updated_at: fallback.data.updated_at || fallback.data.created_at || now
      }
    });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ override: data });
}
