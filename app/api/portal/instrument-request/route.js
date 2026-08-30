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
    .select("student_id,assurance_level,role,portal_people!inner(person_type),portal_students(display_name,instrument_2026)")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .eq("portal_students.status", "active")
    .maybeSingle();
  return data || null;
}

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: trustedLinks, error: trustedError } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id,portal_students!inner(status)")
    .eq("person_id", session.personId)
    .eq("relationship_status", "trusted")
    .eq("portal_students.status", "active");
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
      .from("asset_assignments")
      .select("id,source_ref,starts_at,assignment_status,assets(id,asset_tag,display_name,condition_summary,asset_instruments(instrument_type,brand,serial_number))")
      .in("source_ref", requestIds.map(String))
      .is("ends_at", null);
    assignments = (assignedRows || []).map((assignment) => {
      const asset = Array.isArray(assignment.assets) ? assignment.assets[0] : assignment.assets;
      const instrument = Array.isArray(asset?.asset_instruments) ? asset.asset_instruments[0] : asset?.asset_instruments;
      return {
        instrument_request_id: assignment.source_ref,
        instrument_type: instrument?.instrument_type || "",
        brand: instrument?.brand || "",
        serial_number: instrument?.serial_number || "",
        asset_id: asset?.asset_tag || "",
        issued_condition: asset?.condition_summary || "",
      };
    });
  }
  const byRequest = new Map(assignments.map((item) => [item.instrument_request_id, item]));
  return NextResponse.json({
    requests: (data || []).map((item) => ({ ...item, assignment: byRequest.get(item.id) || null })),
    schoolYear: SCHOOL_YEAR
  }, { headers: { "Cache-Control": "private, no-store" } });
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
    return NextResponse.json({ error: "Complete both signatures and accept the care acknowledgement." }, { status: 400 });
  }

  const link = await trustedStudent(session.personId, studentId);
  if (!link) return NextResponse.json({ error: "Student access not found." }, { status: 403 });
  const actorPerson = Array.isArray(link.portal_people) ? link.portal_people[0] : link.portal_people;
  if (action === "agreement" && (actorPerson?.person_type !== "guardian" || !["medium", "high"].includes(link.assurance_level))) {
    return NextResponse.json({ error: "A verified guardian must submit the care acknowledgement." }, { status: 403 });
  }
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
      return NextResponse.json({ error: "Submit the school instrument acknowledgement before identifying the instrument." }, { status: 409 });
    }
    const assetTag = String(body.assetId || "").trim().slice(0, 120);
    const serialNumber = String(body.serialNumber || "").trim().slice(0, 120);
    const instrumentType = String(body.instrumentType || studentInstrument || "").trim().slice(0, 120);
    const issuedCondition = String(body.issuedCondition || "").trim().slice(0, 80);
    if (!assetTag || !serialNumber || !instrumentType || !issuedCondition) {
      return NextResponse.json({ error: "Enter the instrument type, asset number, serial number, and current condition." }, { status: 400 });
    }
    const { data: asset } = await supabaseAdmin.from("assets")
      .select("id,asset_tag,display_name,condition_summary,asset_instruments(instrument_type,brand,serial_number)")
      .eq("asset_tag", assetTag)
      .eq("asset_type", "instrument")
      .eq("lifecycle_status", "active")
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: "That asset number is not in the connected instrument inventory." }, { status: 404 });
    const connectedInstrument = Array.isArray(asset.asset_instruments) ? asset.asset_instruments[0] : asset.asset_instruments;
    if (connectedInstrument?.serial_number && connectedInstrument.serial_number.trim().toLowerCase() !== serialNumber.toLowerCase()) {
      return NextResponse.json({ error: "The serial number does not match the connected instrument record." }, { status: 409 });
    }
    const { data: assignmentId, error: assignmentError } = await supabaseAdmin.rpc("assign_requested_instrument", {
      p_asset_id: asset.id,
      p_student_id: studentId,
      p_request_id: existing.id,
      p_actor_person_id: session.personId,
      p_actor_staff_id: null,
      p_source: "portal_student_issue",
      p_condition: issuedCondition,
      p_notes: "Identified during the authenticated classroom issue workflow.",
    });
    if (assignmentError) return NextResponse.json({ error: "Could not save the instrument assignment." }, { status: 409 });
    const inventory = {
      id: assignmentId,
      instrument_type: connectedInstrument?.instrument_type || instrumentType,
      brand: connectedInstrument?.brand || "",
      serial_number: connectedInstrument?.serial_number || serialNumber,
      asset_id: asset.asset_tag,
      issued_condition: issuedCondition,
    };
    await logAudit({
      actor: { type: "portal_user", id: session.personId, name: session.email },
      action: "identify_issued_instrument",
      table: "instrument_inventory",
      recordId: assignmentId,
      route: "/api/portal/instrument-request",
      changes: { student_id: studentId, instrument_request_id: existing.id, source: "portal_student_issue" }
    });
    return NextResponse.json({
      ok: true,
      request: { id: existing.id, student_id: studentId, status: "assigned", assignment: inventory }
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (existing) {
    return NextResponse.json({ error: "A school instrument request has already been submitted for this student." }, { status: 409 });
  }

  const { data: submission, error } = await supabaseAdmin
    .from("portal_instrument_requests")
    .insert({
      student_id: studentId,
      submitted_by_person_id: session.personId,
      school_year: SCHOOL_YEAR,
      student_signature: studentSignature,
      guardian_signature: guardianSignature,
      responsibility_accepted: true,
      agreement_version: "ashleybands_interim_instrument_acknowledgement_v1"
    })
    .select("id, submitted_at")
    .single();
  if (error) return NextResponse.json({ error: "Could not save the school instrument request." }, { status: 500 });

  await logAudit({
    actor: { type: "portal_user", id: session.personId, name: session.email },
    action: "submit_instrument_agreement",
    table: "portal_instrument_requests",
    recordId: submission.id,
    route: "/api/portal/instrument-request",
    changes: { student_id: studentId, school_year: SCHOOL_YEAR, guardian_verified: true },
  });

  try {
    await sendPortalReviewAlert({
      subject: `School instrument request submitted — ${studentName}`,
      summary: `${guardianSignature} submitted the AshleyBands interim care acknowledgement for ${studentName}.`,
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

  return NextResponse.json({ ok: true, request: submission }, { headers: { "Cache-Control": "private, no-store" } });
}
