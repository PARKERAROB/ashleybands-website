import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Single source of truth for the marching-band ↔ billing link.
export const MARCHING_BAND_2026_FEE_CENTS = 50000; // $500 flat season fee
export const MARCHING_BAND_2026_CATEGORY = "marching_band_2026";
export const MARCHING_BAND_2026_LABEL = "Marching Band 2026 season fee";

// Matching helpers — same precedence/normalization as app/api/admin/marching-band/route.js.
function clean(value) {
  return String(value || "").trim();
}
function key(value) {
  return clean(value).toLowerCase();
}
export function stripEmailPrefix(value) {
  return key(value).replace(/^email:/, "");
}
export function nameKey(first, last) {
  return key([first, last].filter(Boolean).join(" "));
}

// Build a lookup of student match-keys -> portal_students.id.
function indexPortalStudents(portalStudents) {
  const byKey = new Map();
  for (const student of portalStudents || []) {
    const keys = [
      student.source_student_id,
      student.school_email,
      nameKey(student.legal_first || student.display_name, student.legal_last)
    ]
      .map(stripEmailPrefix)
      .filter(Boolean);
    for (const k of keys) {
      if (!byKey.has(k)) byKey.set(k, student.id);
    }
  }
  return byKey;
}

// Match a single signup payload to a portal_students.id (used by the auto path).
export function findStudentIdForSignup(portalStudents, { sourceStudentId, studentEmail, firstName, lastName }) {
  const byKey = indexPortalStudents(portalStudents);
  const candidates = [sourceStudentId, studentEmail, nameKey(firstName, lastName)]
    .map(stripEmailPrefix)
    .filter(Boolean);
  for (const c of candidates) {
    if (byKey.has(c)) return byKey.get(c);
  }
  return null;
}

// Load every MB signup matched to a portal student. Returns matched student ids
// (deduped) + funding paths + count of signups that could not be matched.
export async function loadMatchedSignups(client = supabaseAdmin) {
  const [{ data: signups, error: signupError }, { data: students, error: studentError }] = await Promise.all([
    client
      .from("marching_band_signup_2026")
      .select("id, funding_path, students(source_student_id, first_name, last_name, student_email)")
      .order("submitted_at", { ascending: false }),
    client
      .from("portal_students")
      .select("id, source_student_id, legal_first, legal_last, display_name, school_email")
  ]);

  if (signupError) throw signupError;
  if (studentError) throw studentError;

  const byKey = indexPortalStudents(students);
  const matchesByStudent = new Map(); // studentId -> { studentId, fundingPath, signupId }
  let unmatchedCount = 0;

  for (const signup of signups || []) {
    const s = signup.students || {};
    const candidates = [s.source_student_id, s.student_email, nameKey(s.first_name, s.last_name)]
      .map(stripEmailPrefix)
      .filter(Boolean);
    let studentId = null;
    for (const c of candidates) {
      if (byKey.has(c)) {
        studentId = byKey.get(c);
        break;
      }
    }
    if (!studentId) {
      unmatchedCount += 1;
      continue;
    }
    // Keep the most recent signup per student (signups are ordered desc).
    if (!matchesByStudent.has(studentId)) {
      matchesByStudent.set(studentId, {
        studentId,
        fundingPath: signup.funding_path || "",
        signupId: signup.id
      });
    }
  }

  return { matches: [...matchesByStudent.values()], unmatchedCount };
}
