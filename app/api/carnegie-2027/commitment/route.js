import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  carnegieSubmissionStatus,
  findCarnegieStudentFromPublicIdentity,
  isPortalGuardianForStudent,
  recordCarnegieSubmission,
  validateCarnegieSubmission,
} from "@/lib/carnegieTrip";

export const runtime = "nodejs";

function privateJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const session = readPortalSession(request);
  const requestedStudentId = String(body.studentId || "");
  let student;
  let source;
  let personId = null;
  let actor;

  if (requestedStudentId) {
    if (!session?.personId) return privateJson({ error: "Sign in to submit for this student." }, 401);
    if (!await isPortalGuardianForStudent(session.personId, requestedStudentId)) {
      return privateJson({ error: "A verified parent or guardian must submit this commitment." }, 403);
    }
    const { data, error } = await supabaseAdmin.from("portal_students")
      .select("id,display_name,ensemble_2026,status").eq("id", requestedStudentId).eq("status", "active").maybeSingle();
    if (error || !data) return privateJson({ error: "That student is not available for this form." }, 404);
    student = data;
    source = "portal";
    personId = session.personId;
    actor = { type: "parent", id: session.personId, name: session.email || body.guardianName || "Family Portal" };
  } else {
    const email = String(body.schoolEmail || "").trim().toLowerCase();
    const emailHash = crypto.createHash("sha256").update(email).digest("hex").slice(0, 20);
    const [ipLimit, identityLimit] = await Promise.all([
      checkRateLimit({ key: `carnegie-commitment-ip:${clientIp(request)}`, limit: 80, windowMs: 15 * 60 * 1000 }),
      checkRateLimit({ key: `carnegie-commitment-identity:${emailHash}`, limit: 8, windowMs: 15 * 60 * 1000 }),
    ]);
    if (!ipLimit.allowed || !identityLimit.allowed) {
      return privateJson({ error: "Please wait a few minutes before trying again." }, 429);
    }
    student = await findCarnegieStudentFromPublicIdentity({
      firstName: body.studentFirst,
      lastName: body.studentLast,
      schoolEmail: email,
    });
    if (!student) {
      return privateJson({
        error: "We could not connect those details to the current trip roster. Check the student's NHCS email, or ask staff for help.",
      }, 404);
    }
    source = "public";
    actor = { type: "parent", id: null, name: body.guardianName || "Public Carnegie form" };
  }

  const fields = validateCarnegieSubmission(body);
  if (fields.error) return privateJson({ error: fields.error }, 400);
  const submissionKey = String(body.submissionKey || "").trim();
  if (!submissionKey || submissionKey.length > 200) return privateJson({ error: "Reload the form and try again." }, 400);

  try {
    const result = await recordCarnegieSubmission({
      studentId: student.id,
      source,
      fields,
      submissionKey,
      personId,
      actor,
      request,
      route: "/api/carnegie-2027/commitment",
    });
    const { data: submission, error } = await supabaseAdmin.from("carnegie_trip_submissions")
      .select("id,student_id,source,response,maximum_family_amount_band,agreement_version,guardian_email,signed_at,created_at")
      .eq("id", result.submissionId).maybeSingle();
    if (error || !submission) throw new Error("Submission could not be reloaded.");
    const status = await carnegieSubmissionStatus(submission);
    return privateJson({ ok: true, studentName: student.display_name, ...status });
  } catch (error) {
    console.error("Carnegie commitment submission failed.", error);
    return privateJson({ error: "The commitment could not be saved. Please try again." }, 500);
  }
}
