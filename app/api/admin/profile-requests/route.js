import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const { data, error } = await supabaseAdmin
    .from("portal_review_queue")
    .select(
      "id, item_type, status, summary, details, email_alert_status, email_alert_sent_at, email_alert_error, created_at, portal_students(display_name, grade_fall26, status), portal_people(display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    staff: { displayName: staff.display_name, role: staff.role },
    requests: data || []
  });
}

export async function PATCH(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.MEMBERSHIPS_WRITE);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["needs_review", "approved", "rejected", "merged", "needs_followup"].includes(status)) {
    return NextResponse.json({ error: "Valid id and status are required." }, { status: 400 });
  }

  const { data: item } = await supabaseAdmin
    .from("portal_review_queue")
    .select("id, item_type, student_id, update_request_id, details")
    .eq("id", id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Review item not found." }, { status: 404 });

  const reviewedAt = new Date().toISOString();
  if (item.item_type === "participation_change" && status === "approved") {
    const requested = item.details?.requested_value || {};
    const { error: studentError } = await supabaseAdmin.rpc("portal_apply_participation_change", {
      p_student_id: item.student_id,
      p_band_period: requested.bandPeriod || null,
      p_ensemble: requested.ensemble === "Not currently assigned" ? null : requested.ensemble || null,
      p_instrument: requested.concertInstrument || null,
      p_marching: requested.marchingEnrollment || null,
      p_marching_role_category: requested.marchingEnrollment === "Yes" ? requested.marchingRole || null : null,
      p_marching_assignment: requested.marchingEnrollment === "Yes" ? requested.marchingAssignment || null : null,
      p_changed_at: reviewedAt,
    });
    if (studentError) return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  if (item.update_request_id) {
    const { error: updateError } = await supabaseAdmin
      .from("portal_update_requests")
      .update({ status, reviewed_by: staff.display_name, reviewed_at: reviewedAt, review_notes: String(body.reviewNotes || "").trim() || null })
      .eq("id", item.update_request_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from("portal_review_queue")
    .update({
      status,
      details: {
        ...(body.details || {}),
        reviewed_by: staff.display_name,
        reviewed_at: reviewedAt,
        review_notes: String(body.reviewNotes || "").trim() || null
      }
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({
    actor: staffActor(staff),
    action: status,
    table: item.item_type === "participation_change" ? "portal_students" : "portal_review_queue",
    recordId: item.student_id || item.id,
    route: "/api/admin/profile-requests",
    changes: { review_item_id: item.id, item_type: item.item_type, requested: item.details?.requested_value || null, status }
  });
  return NextResponse.json({ ok: true });
}
