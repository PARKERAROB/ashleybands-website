import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalCodeEmail } from "@/lib/portalEmail";
import { createNumericCode, hashCode } from "@/lib/portalTokens";

export const runtime = "nodejs";

const CONFIRM_CODE_MINUTES = 30;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const guardianName = clean(body.guardianName);
  const guardianEmail = clean(body.guardianEmail).toLowerCase();
  const guardianPhone = clean(body.guardianPhone);
  const studentFirst = clean(body.studentFirst);
  const studentLast = clean(body.studentLast);
  const studentGrade = clean(body.studentGrade);
  const instrumentOrNote = clean(body.instrumentOrNote);

  if (!guardianName || !guardianEmail || !studentFirst || !studentLast) {
    return NextResponse.json({ error: "Guardian name, guardian email, student first name, and student last name are required." }, { status: 400 });
  }
  if (!guardianEmail.includes("@")) {
    return NextResponse.json({ error: "Enter a valid guardian email address." }, { status: 400 });
  }

  const match = await findStudentMatch({ studentFirst, studentLast, studentGrade });
  const { data: accessRequest, error: requestError } = await supabaseAdmin
    .from("portal_access_requests")
    .insert({
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      guardian_phone: guardianPhone || null,
      student_first: studentFirst,
      student_last: studentLast,
      student_grade: studentGrade || null,
      instrument_or_note: instrumentOrNote || null,
      claimed_student_id: match.studentId,
      match_confidence: match.confidence,
      status: "new",
      ip_created: request.headers.get("x-forwarded-for") || null,
      user_agent_created: request.headers.get("user-agent") || null
    })
    .select("id")
    .single();

  if (requestError) {
    return NextResponse.json({ error: "Could not create access request." }, { status: 500 });
  }

  const code = createNumericCode();
  const expiresAt = new Date(Date.now() + CONFIRM_CODE_MINUTES * 60 * 1000).toISOString();

  // Supersede any earlier un-consumed confirm codes for this email so verify is
  // unambiguous (the family may have submitted the form more than once).
  await supabaseAdmin
    .from("portal_magic_links")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", guardianEmail)
    .eq("purpose", "unknown_email_confirm")
    .is("consumed_at", null);

  const { error: linkError } = await supabaseAdmin
    .from("portal_magic_links")
    .insert({
      access_request_id: accessRequest.id,
      token_hash: hashCode(guardianEmail, code),
      purpose: "unknown_email_confirm",
      email: guardianEmail,
      expires_at: expiresAt,
      ip_created: request.headers.get("x-forwarded-for") || null,
      user_agent_created: request.headers.get("user-agent") || null
    });

  if (linkError) {
    return NextResponse.json({ error: "Could not create confirmation code." }, { status: 500 });
  }

  try {
    await sendPortalCodeEmail({ to: guardianEmail, code, expiresMinutes: CONFIRM_CODE_MINUTES });
  } catch (sendError) {
    await supabaseAdmin
      .from("portal_magic_links")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token_hash", hashCode(guardianEmail, code));
    console.error("Portal access-request code email failed to send.", sendError);
    return NextResponse.json({ error: "We could not send the verification code. Check the email address and try again." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}

async function findStudentMatch({ studentFirst, studentLast, studentGrade }) {
  const { data } = await supabaseAdmin
    .from("portal_students")
    .select("id, legal_first, preferred_first, legal_last, grade_fall26")
    .ilike("legal_last", studentLast)
    .limit(10);

  // Parents write first names like "Riley (Vera)" or "Cassie" - compare every
  // reasonable candidate form against both legal and preferred first names.
  const firstCandidates = firstNameCandidates(studentFirst);
  const gradeNorm = norm(studentGrade);
  const matches = (data || []).filter((student) =>
    [student.legal_first, student.preferred_first].some((name) => firstCandidates.includes(norm(name)))
  );
  if (matches.length === 1) {
    const gradeMatches = !gradeNorm || norm(matches[0].grade_fall26).includes(gradeNorm.replace("rising ", ""));
    return { studentId: matches[0].id, confidence: gradeMatches ? "likely" : "possible" };
  }
  return { studentId: null, confidence: matches.length > 1 ? "possible" : "none" };
}

function clean(value) {
  return String(value || "").trim().slice(0, 500);
}

function norm(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function firstNameCandidates(raw) {
  const s = String(raw || "");
  const inParen = (s.match(/\(([^)]+)\)/) || [])[1] || "";
  const candidates = [norm(s), norm(s.replace(/\([^)]*\)/g, "")), norm(inParen)];
  return [...new Set(candidates)].filter(Boolean);
}
