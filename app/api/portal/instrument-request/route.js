import { NextResponse } from "next/server";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

const SCHOOL_YEAR = "2026-2027";

async function trustedStudent(personId, studentId) {
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id, portal_students(display_name, instrument_2026)")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  return data || null;
}

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: trustedLinks, error: trustedError } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id")
    .eq("person_id", session.personId)
    .eq("relationship_status", "trusted");
  if (trustedError) return NextResponse.json({ error: "Could not load student access." }, { status: 500 });
  const studentIds = (trustedLinks || []).map((item) => item.student_id);
  if (!studentIds.length) return NextResponse.json({ requests: [], schoolYear: SCHOOL_YEAR });

  const { data, error } = await supabaseAdmin
    .from("portal_instrument_requests")
    .select("id, student_id, status, submitted_at")
    .in("student_id", studentIds)
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
  const action = body.action === "identify" ? "identify" : "agreement";
  const studentSignature = String(body.studentSignature || "").trim().slice(0, 200);
  const guardianSignature = String(body.guardianSignature || "").trim().slice(0, 200);
  const accepted = body.responsibilityAccepted === true;

  if (!studentId) {
    return NextResponse.json({ error: "Choose a student." }, { status: 400 });
  }
  if (action === "agreement" && (!studentSignature || !guardianSignature || !accepted)) {
    return NextResponse.json({ error: "Complete both signatures and accept the responsibility agreement." }, { status: 400 });
  }

  const link = await trustedStudent(session.personId, studentId);
  if (!link) return NextResponse.json({ error: "Student access not found." }, { status: 403 });
  const studentName = link.portal_students?.display_name || "Student";
  const studentInstrument = link.portal_students?.instrument_2026 || "";

  const { data: existing } = await supabaseAdmin
    .from("portal_instrument_requests")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("school_year", SCHOOL_YEAR)
    .maybeSingle();
  if (action === "identify") {
    if (!existing) {
      return NextResponse.json({ error: "Submit the county instrument agreement before identifying the instrument." }, { status: 409 });
    }
    const assetId = String(body.assetId || "").trim().slice(0, 120);
    const serialNumber = String(body.serialNumber || "").trim().slice(0, 120);
    const instrumentType = String(body.instrumentType || studentInstrument || "").trim().slice(0, 120);
    const issuedCondition = String(body.issuedCondition || "").trim().slice(0, 80);
    if (!assetId || !serialNumber || !instrumentType || !issuedCondition) {
      return NextResponse.json({ error: "Enter the instrument type, asset number, serial number, and current condition." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from("instrument_inventory")
      .insert({
        asset_id: assetId,
        serial_number: serialNumber,
        instrument_type: instrumentType,
        condition_notes: `Condition when identified: ${issuedCondition}`,
        submitted_by: studentName,
        submitted_by_person_id: session.personId,
        assigned_student_id: studentId,
        instrument_request_id: existing.id,
        issued_at: now,
        issued_by: session.email || "verified portal user",
        issued_condition: issuedCondition,
        assignment_notes: "Student-entered during the authenticated classroom issue workflow.",
        source: "portal_student_issue",
        review_status: "pending"
      })
      .select("id, instrument_type, brand, serial_number, asset_id, issued_condition")
      .single();
    if (inventoryError) {
      if (inventoryError.code === "23505") return NextResponse.json({ error: "This request already has an identified instrument." }, { status: 409 });
      return NextResponse.json({ error: "Could not save the instrument identification." }, { status: 500 });
    }
    const { error: statusError } = await supabaseAdmin
      .from("portal_instrument_requests")
      .update({ status: "assigned", updated_at: now })
      .eq("id", existing.id);
    if (statusError) return NextResponse.json({ error: "The instrument was saved, but its request status could not be updated." }, { status: 500 });
    await logAudit({
      actor: { type: "portal_user", id: session.personId, name: session.email },
      action: "identify_issued_instrument",
      table: "instrument_inventory",
      recordId: inventory.id,
      route: "/api/portal/instrument-request",
      changes: { student_id: studentId, instrument_request_id: existing.id, source: "portal_student_issue" }
    });
    return NextResponse.json({
      ok: true,
      request: { id: existing.id, student_id: studentId, status: "assigned", assignment: inventory }
    });
  }
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
