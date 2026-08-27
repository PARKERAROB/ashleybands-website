import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const LINK_CODE_RE = /^[A-Za-z0-9_-]{10,24}$/;

function firstName(student) {
  return String(
    student?.preferred_first
      || student?.legal_first
      || student?.display_name
      || "Band student"
  ).trim().split(/\s+/)[0];
}

function portalDisplayName(student) {
  return String(student?.display_name || [student?.legal_first, student?.legal_last].filter(Boolean).join(" ") || "Band student").trim();
}

async function loadActiveStudents(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin
    .from("portal_students")
    .select("id, display_name, preferred_first, legal_first, legal_last, status")
    .in("id", ids)
    .eq("status", "active")
    .order("legal_last", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((student) => ({
    ...student,
    public_name: firstName(student),
    portal_name: portalDisplayName(student)
  }));
}

// Return only active students the signed-in portal person is trusted to access. The
// portal_student_id fallback preserves compatibility with the old emergency PIN family.
export async function loadAuthorizedSponsorStudents(family) {
  let studentIds = [];
  if (family?.portal_person_id) {
    const { data, error } = await supabaseAdmin
      .from("portal_student_people")
      .select("student_id")
      .eq("person_id", family.portal_person_id)
      .eq("relationship_status", "trusted");
    if (error) throw new Error(error.message);
    studentIds = (data || []).map((row) => row.student_id);
  }
  if (!studentIds.length && family?.portal_student_id) {
    studentIds = [family.portal_student_id];
  }
  return loadActiveStudents(studentIds);
}

async function ensureOneStudentLink(studentId) {
  const { data: existing, error: readError } = await supabaseAdmin
    .from("sponsor_student_links")
    .select("id, portal_student_id, code, active")
    .eq("portal_student_id", studentId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) return existing;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = crypto.randomBytes(9).toString("base64url");
    const { data, error } = await supabaseAdmin
      .from("sponsor_student_links")
      .insert({ portal_student_id: studentId, code, source: "family_portal" })
      .select("id, portal_student_id, code, active")
      .single();
    if (!error && data) return data;

    // Another request may have created this student's link while this request was in flight.
    const { data: concurrent } = await supabaseAdmin
      .from("sponsor_student_links")
      .select("id, portal_student_id, code, active")
      .eq("portal_student_id", studentId)
      .maybeSingle();
    if (concurrent) return concurrent;
    if (error?.code !== "23505") throw new Error(error?.message || "Could not create the student link.");
  }
  throw new Error("Could not create a unique student link.");
}

export async function ensureSponsorStudentLinks(students) {
  return Promise.all((students || []).map(async (student) => ({
    student,
    link: await ensureOneStudentLink(student.id)
  })));
}

async function resolveActiveLink(query) {
  const { data: link, error } = await query.maybeSingle();
  if (error || !link || !link.active) return null;
  const students = await loadActiveStudents([link.portal_student_id]);
  const student = students[0];
  if (!student) return null;
  return { link, student };
}

export async function resolveSponsorStudentCode(code) {
  const clean = String(code || "").trim();
  if (!LINK_CODE_RE.test(clean)) return null;
  return resolveActiveLink(
    supabaseAdmin
      .from("sponsor_student_links")
      .select("id, portal_student_id, code, active")
      .eq("code", clean)
  );
}

export async function resolveSponsorStudentTokenClaims({ linkId, studentId }) {
  if (!linkId || !studentId) return null;
  const resolved = await resolveActiveLink(
    supabaseAdmin
      .from("sponsor_student_links")
      .select("id, portal_student_id, code, active")
      .eq("id", linkId)
      .eq("portal_student_id", studentId)
  );
  if (!resolved) return null;
  return {
    linkId: resolved.link.id,
    portalStudentId: resolved.student.id,
    studentName: resolved.student.public_name
  };
}
