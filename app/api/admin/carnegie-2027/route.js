import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, logAuditRequired, staffActor } from "@/lib/auditLog";
import { loadCarnegieDashboard, recordCarnegieSubmission, validateCarnegieSubmission } from "@/lib/carnegieTrip";
import { CARNEGIE_DEPOSIT_CATEGORY } from "@/lib/carnegieTripConstants";
import { refundCapture } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const TRACKING_FIELDS = {
  eligibilityStatus: new Set(["not_reviewed", "preapproved", "approved", "needs_review", "not_approved"]),
  followUpStatus: new Set(["none", "login_help", "contact_needed", "complete"]),
};

function privateJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function authorizeWorkspace(request, capability, studentId = "") {
  return authorizeStaffRequest(request, capability, studentId
    ? { scope: { type: "student", ref: studentId } }
    : { scope: { type: "global", ref: "" } });
}

export async function GET(request) {
  const authorization = await authorizeWorkspace(request, [
    STAFF_CAPABILITIES.FORMS_STATUS_READ,
    STAFF_CAPABILITIES.BILLING_READ,
  ]);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const data = await loadCarnegieDashboard();
    await logAudit({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "carnegie_trip_submissions,fee_charges,fee_payments",
      recordId: "carnegie-2027-workspace",
      changes: { student_count: data.rows.length },
      route: "/api/admin/carnegie-2027",
    });
    return privateJson(data);
  } catch (error) {
    console.error("Carnegie staff workspace failed to load.", error);
    return privateJson({ error: "Could not load the Carnegie commitment workspace." }, 500);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "verbal");

  if (action === "refund") {
    const paymentId = String(body.paymentId || "");
    if (!paymentId) return privateJson({ error: "Choose a payment to refund." }, 400);
    const { data: payment, error: paymentError } = await supabaseAdmin.from("fee_payments")
      .select("id,student_id,status,method,category,paypal_capture_id")
      .eq("id", paymentId).maybeSingle();
    if (paymentError || !payment) return privateJson({ error: "Payment not found." }, 404);
    const authorization = await authorizeWorkspace(request, STAFF_CAPABILITIES.BILLING_WRITE, payment.student_id);
    if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
    if (payment.status !== "completed" || payment.method !== "paypal" || payment.category !== CARNEGIE_DEPOSIT_CATEGORY || !payment.paypal_capture_id) {
      return privateJson({ error: "Only a completed Carnegie PayPal payment can be refunded here." }, 409);
    }
    const { data: openRefund } = await supabaseAdmin.from("carnegie_trip_refund_events")
      .select("id,status").eq("payment_id", payment.id).in("status", ["requested", "pending"]).limit(1).maybeSingle();
    if (openRefund) return privateJson({ error: "A refund is already being processed for this payment." }, 409);
    const eventId = crypto.randomUUID();
    const { error: eventError } = await supabaseAdmin.from("carnegie_trip_refund_events").insert({
      id: eventId,
      payment_id: payment.id,
      requested_by_staff_id: authorization.staff.id,
      status: "requested",
    });
    if (eventError) return privateJson({ error: "A refund is already being processed for this payment." }, 409);
    try {
      const refund = await refundCapture(payment.paypal_capture_id, { requestId: eventId });
      const refundStatus = String(refund.status || "").toUpperCase();
      if (!new Set(["COMPLETED", "PENDING"]).has(refundStatus)) throw new Error(`Unexpected PayPal refund status: ${refundStatus || "missing"}`);
      if (refundStatus === "COMPLETED") {
        const { error: settleError } = await supabaseAdmin.rpc("settle_online_fee_refund_with_audit", {
          p_payment_id: payment.id,
          p_actor_type: "staff",
          p_actor_id: authorization.staff.id,
          p_actor_name: authorization.staff.display_name,
          p_route: "/api/admin/carnegie-2027",
        });
        if (settleError) {
          await supabaseAdmin.from("carnegie_trip_refund_events").update({
            status: "pending",
            paypal_refund_id: String(refund.id || ""),
            error_summary: `PayPal completed the refund; ledger reconciliation pending: ${String(settleError.message).slice(0, 350)}`,
          }).eq("id", eventId);
          return privateJson({ error: "PayPal completed the refund, but the AshleyBands ledger still needs automatic or staff reconciliation." }, 503);
        }
      }
      await supabaseAdmin.from("carnegie_trip_refund_events").update({
        status: refundStatus === "COMPLETED" ? "completed" : "pending",
        paypal_refund_id: String(refund.id || ""),
        completed_at: refundStatus === "COMPLETED" ? new Date().toISOString() : null,
      }).eq("id", eventId);
      return privateJson({ ok: true, status: refundStatus.toLowerCase() });
    } catch (error) {
      await supabaseAdmin.from("carnegie_trip_refund_events").update({
        status: "failed",
        error_summary: String(error?.message || "Refund failed").slice(0, 500),
      }).eq("id", eventId);
      console.error("Carnegie refund failed.", error);
      return privateJson({ error: "PayPal did not accept the refund. The AshleyBands ledger was not changed." }, 502);
    }
  }

  const studentId = String(body.studentId || "");
  if (!studentId) return privateJson({ error: "Choose a student." }, 400);
  const authorization = await authorizeWorkspace(request, [
    STAFF_CAPABILITIES.FORMS_MANAGE,
    STAFF_CAPABILITIES.BILLING_WRITE,
  ], studentId);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const fields = validateCarnegieSubmission(body, { staffVerbal: true });
  if (fields.error) return privateJson({ error: fields.error }, 400);
  try {
    const result = await recordCarnegieSubmission({
      studentId,
      source: "staff_verbal",
      fields,
      submissionKey: String(body.submissionKey || crypto.randomUUID()),
      staffId: authorization.staff.id,
      actor: staffActor(authorization.staff),
      request,
      route: "/api/admin/carnegie-2027",
    });
    return privateJson({ ok: true, ...result });
  } catch (error) {
    console.error("Staff verbal Carnegie commitment failed.", error);
    return privateJson({ error: "Could not save the verbal commitment." }, 500);
  }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  const eligibilityStatus = String(body.eligibilityStatus || "");
  const followUpStatus = String(body.followUpStatus || "");
  if (!studentId || !TRACKING_FIELDS.eligibilityStatus.has(eligibilityStatus) || !TRACKING_FIELDS.followUpStatus.has(followUpStatus)) {
    return privateJson({ error: "Choose valid eligibility and follow-up states." }, 400);
  }
  const authorization = await authorizeWorkspace(request, STAFF_CAPABILITIES.FORMS_MANAGE, studentId);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staffNote = String(body.staffNote || "").trim().slice(0, 1000);
  const { error } = await supabaseAdmin.from("carnegie_trip_staff_tracking").upsert({
    student_id: studentId,
    eligibility_status: eligibilityStatus,
    follow_up_status: followUpStatus,
    staff_note: staffNote,
    updated_by_staff_id: authorization.staff.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "student_id" });
  if (error) return privateJson({ error: "Could not update staff follow-up." }, 500);
  try {
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "update",
      table: "carnegie_trip_staff_tracking",
      recordId: studentId,
      changes: { eligibility_status: eligibilityStatus, follow_up_status: followUpStatus, staff_note: staffNote },
      route: "/api/admin/carnegie-2027",
    });
  } catch {
    return privateJson({ error: "The follow-up changed, but its audit record needs review." }, 503);
  }
  return privateJson({ ok: true });
}
