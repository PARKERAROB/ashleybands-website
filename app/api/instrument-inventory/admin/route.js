import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";

export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const [{ data, error }, { data: agreements, error: agreementError }] = await Promise.all([
      supabaseAdmin.from("instrument_inventory").select("*").order("submitted_at", { ascending: false }),
      supabaseAdmin
        .from("portal_instrument_requests")
        .select("id, student_id, submitted_at, portal_students(display_name, grade_fall26)")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true })
    ]);

    if (error || agreementError) return NextResponse.json({ error: (error || agreementError).message }, { status: 500 });
    await logAudit({
      actor: staffActor(staff), action: "view_assignment_queue",
      table: "portal_instrument_requests", route: "/api/instrument-inventory/admin",
      changes: { inventory_count: (data || []).length, eligible_student_count: (agreements || []).length }
    });
    return NextResponse.json({ items: data || [], eligibleStudents: agreements || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, review_status, action } = body;

    if (action === "assign") {
      const requestId = String(body.requestId || "").trim();
      if (!id || !requestId) return NextResponse.json({ error: "Instrument and signed agreement are required." }, { status: 400 });
      const { data: agreement } = await supabaseAdmin
        .from("portal_instrument_requests")
        .select("id, student_id, status")
        .eq("id", requestId)
        .eq("status", "submitted")
        .maybeSingle();
      if (!agreement) return NextResponse.json({ error: "That agreement is no longer available." }, { status: 409 });

      const now = new Date().toISOString();
      const { error: assignError } = await supabaseAdmin.from("instrument_inventory").update({
        assigned_student_id: agreement.student_id,
        instrument_request_id: agreement.id,
        issued_at: now,
        issued_by: staff.display_name,
        issued_condition: String(body.issuedCondition || "").trim(),
        assignment_notes: String(body.assignmentNotes || "").trim()
      }).eq("id", id);
      if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });
      const { error: requestError } = await supabaseAdmin
        .from("portal_instrument_requests")
        .update({ status: "assigned", updated_at: now })
        .eq("id", agreement.id);
      if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });
      await logAudit({
        actor: staffActor(staff), action: "assign_instrument",
        table: "instrument_inventory", recordId: id,
        route: "/api/instrument-inventory/admin",
        changes: { student_id: agreement.student_id, instrument_request_id: agreement.id }
      });
      return NextResponse.json({ ok: true });
    }

    if (!id || !["reviewed", "verified", "rejected"].includes(review_status)) {
      return NextResponse.json({ error: "Valid id and review_status required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("instrument_inventory")
      .update({
        review_status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: staff.display_name,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({
      actor: staffActor(staff), action: "update_review_status",
      table: "instrument_inventory", recordId: data.id,
      route: "/api/instrument-inventory/admin", changes: { review_status }
    });
    return NextResponse.json({ id: data.id, status: review_status });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
