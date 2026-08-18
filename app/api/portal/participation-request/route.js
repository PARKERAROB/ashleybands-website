import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { logAudit } from "@/lib/auditLog";
import {
  BAND_PERIOD_OPTIONS,
  ENSEMBLE_OPTIONS,
  CONCERT_INSTRUMENT_OPTIONS,
  MARCHING_ENROLLMENT_OPTIONS,
  MARCHING_ROLE_OPTIONS,
  MARCHING_ASSIGNMENTS
} from "@/lib/participationOptions";

export const runtime = "nodejs";

const FIELD_NAME = "participation_bundle";

function validChoice(value, options) {
  return options.includes(String(value || "").trim());
}

async function trustedStudent(personId, studentId) {
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id, portal_students(id, display_name, band_period_2026, ensemble_2026, instrument_2026, marching_2026, mb_role_2026, marching_role_category_2026, marching_assignment_2026)")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  return data?.portal_students || null;
}

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const requested = {
    bandPeriod: String(body.bandPeriod || "").trim(),
    ensemble: String(body.ensemble || "").trim(),
    concertInstrument: String(body.concertInstrument || "").trim(),
    marchingEnrollment: String(body.marchingEnrollment || "").trim(),
    marchingRole: String(body.marchingRole || "").trim(),
    marchingAssignment: String(body.marchingAssignment || "").trim()
  };
  const note = String(body.note || "").trim().slice(0, 1000);
  const student = await trustedStudent(session.personId, studentId);
  if (!student) return NextResponse.json({ error: "Student access not found." }, { status: 403 });

  if (!validChoice(requested.bandPeriod, BAND_PERIOD_OPTIONS) ||
      !(validChoice(requested.ensemble, ENSEMBLE_OPTIONS) || requested.ensemble === student.ensemble_2026) ||
      !(validChoice(requested.concertInstrument, CONCERT_INSTRUMENT_OPTIONS) || requested.concertInstrument === student.instrument_2026) ||
      !validChoice(requested.marchingEnrollment, MARCHING_ENROLLMENT_OPTIONS)) {
    return NextResponse.json({ error: "Choose a listed value for each participation field." }, { status: 400 });
  }
  if (requested.marchingEnrollment === "No") {
    requested.marchingRole = "";
    requested.marchingAssignment = "";
  } else if (!validChoice(requested.marchingRole, MARCHING_ROLE_OPTIONS) ||
      !(validChoice(requested.marchingAssignment, MARCHING_ASSIGNMENTS[requested.marchingRole] || []) ||
        requested.marchingAssignment === student.instrument_2026 || requested.marchingAssignment === student.mb_role_2026)) {
    return NextResponse.json({ error: "Choose a marching role and an assignment from its list." }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("portal_update_requests")
    .select("id")
    .eq("submitted_by_person_id", session.personId)
    .eq("student_id", studentId)
    .eq("field_name", FIELD_NAME)
    .eq("status", "needs_review")
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "A participation request is already awaiting review." }, { status: 409 });

  const oldValue = {
    bandPeriod: student.band_period_2026 || "",
    ensemble: student.ensemble_2026 || "",
    concertInstrument: student.instrument_2026 || "",
    marchingEnrollment: student.marching_2026 || "",
    marchingRole: student.marching_role_category_2026 || "",
    marchingAssignment: student.marching_assignment_2026 || ""
  };
  const now = new Date().toISOString();
  const { data: updateRequest, error: updateError } = await supabaseAdmin
    .from("portal_update_requests")
    .insert({
      submitted_by_person_id: session.personId,
      student_id: studentId,
      target_table: "portal_students",
      target_id: studentId,
      field_name: FIELD_NAME,
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(requested),
      sensitivity: "internal",
      status: "needs_review",
      review_notes: note || null
    })
    .select("id")
    .single();
  if (updateError) return NextResponse.json({ error: "Could not save the participation request." }, { status: 500 });

  const summary = `${session.email} requested participation changes for ${student.display_name}`;
  const { data: reviewItem, error: reviewError } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "participation_change",
      status: "needs_review",
      student_id: studentId,
      person_id: session.personId,
      update_request_id: updateRequest.id,
      summary,
      details: { old_value: oldValue, requested_value: requested, family_note: note || null },
      email_alert_status: "skipped"
    })
    .select("id")
    .single();
  if (reviewError) {
    await supabaseAdmin.from("portal_update_requests").delete().eq("id", updateRequest.id);
    return NextResponse.json({ error: "Could not create the staff review item." }, { status: 500 });
  }
  await supabaseAdmin.from("portal_update_requests").update({ review_item_id: reviewItem.id }).eq("id", updateRequest.id);
  await logAudit({
    actor: { type: "parent", id: session.personId, name: session.email },
    action: "request",
    table: "portal_students",
    recordId: studentId,
    route: "/api/portal/participation-request",
    changes: { old: oldValue, requested, review_item_id: reviewItem.id }
  });
  return NextResponse.json({ ok: true, requestId: updateRequest.id, status: "needs_review" });
}

export async function DELETE(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const requestId = String(body.requestId || "").trim();
  const { data: updateRequest } = await supabaseAdmin
    .from("portal_update_requests")
    .select("id, review_item_id, student_id")
    .eq("id", requestId)
    .eq("submitted_by_person_id", session.personId)
    .eq("field_name", FIELD_NAME)
    .eq("status", "needs_review")
    .maybeSingle();
  if (!updateRequest) return NextResponse.json({ error: "Pending request not found." }, { status: 404 });
  const now = new Date().toISOString();
  await supabaseAdmin.from("portal_update_requests").update({ status: "rejected", reviewed_at: now, reviewed_by: session.email, review_notes: "Withdrawn by family." }).eq("id", requestId);
  if (updateRequest.review_item_id) {
    await supabaseAdmin.from("portal_review_queue").update({ status: "rejected", details: { withdrawn_by_family: true, withdrawn_at: now } }).eq("id", updateRequest.review_item_id);
  }
  await logAudit({ actor: { type: "parent", id: session.personId, name: session.email }, action: "withdraw", table: "portal_update_requests", recordId: requestId, route: "/api/portal/participation-request", changes: { status: "rejected" } });
  return NextResponse.json({ ok: true });
}
