import { NextResponse } from "next/server";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

const SCHOOL_YEAR = "2026-2027";

async function trustedStudent(personId, studentId) {
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id, portal_students(display_name)")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  return data || null;
}

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("portal_instrument_requests")
    .select("id, student_id, status, submitted_at")
    .eq("submitted_by_person_id", session.personId)
    .eq("school_year", SCHOOL_YEAR);

  if (error) return NextResponse.json({ error: "Could not load instrument requests." }, { status: 500 });
  const requestIds = (data || []).map((item) => item.id);
  let assignments = [];
  if (requestIds.length) {
    const { data: assignedRows } = await supabaseAdmin
      .from("instrument_inventory")
      .select("instrument_request_id, instrument_type, brand, serial_number, asset_id, issued_condition")
      .in("instrument_request_id", requestIds);
    assignments = assignedRows || [];
  }
  const byRequest = new Map(assignments.map((item) => [item.instrument_request_id, item]));
  return NextResponse.json({
    requests: (data || []).map((item) => ({ ...item, assignment: byRequest.get(item.id) || null })),
    schoolYear: SCHOOL_YEAR
  });
}

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const studentSignature = String(body.studentSignature || "").trim().slice(0, 200);
  const guardianSignature = String(body.guardianSignature || "").trim().slice(0, 200);
  const accepted = body.responsibilityAccepted === true;

  if (!studentId || !studentSignature || !guardianSignature || !accepted) {
    return NextResponse.json({ error: "Complete both signatures and accept the responsibility agreement." }, { status: 400 });
  }

  const link = await trustedStudent(session.personId, studentId);
  if (!link) return NextResponse.json({ error: "Student access not found." }, { status: 403 });
  const studentName = link.portal_students?.display_name || "Student";

  const { data: existing } = await supabaseAdmin
    .from("portal_instrument_requests")
    .select("id")
    .eq("student_id", studentId)
    .eq("school_year", SCHOOL_YEAR)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "An instrument agreement has already been submitted for this student." }, { status: 409 });
  }

  const { data: submission, error } = await supabaseAdmin
    .from("portal_instrument_requests")
    .insert({
      student_id: studentId,
      submitted_by_person_id: session.personId,
      school_year: SCHOOL_YEAR,
      student_signature: studentSignature,
      guardian_signature: guardianSignature,
      responsibility_accepted: true
    })
    .select("id, submitted_at")
    .single();
  if (error) return NextResponse.json({ error: "Could not save the instrument agreement." }, { status: 500 });

  try {
    await sendPortalReviewAlert({
      subject: `Instrument agreement submitted — ${studentName}`,
      summary: `${guardianSignature} submitted the NHCS instrument responsibility agreement for ${studentName}.`,
      reviewUrl: `${new URL(request.url).origin}/admin/instrument-inventory`,
      details: [
        `School year: ${SCHOOL_YEAR}`,
        `Student signature: ${studentSignature}`,
        `Guardian signature: ${guardianSignature}`,
        `Portal email: ${session.email}`,
        "This student is now available in the Instrument Inventory assignment picker."
      ]
    });
  } catch {
    // The signed record is durable even if the notification provider is unavailable.
  }

  return NextResponse.json({ ok: true, request: submission });
}
