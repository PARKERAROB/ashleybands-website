import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(req) {
  const access = await authorizeStaffRequest(req, STAFF_CAPABILITIES.ASSETS_READ);
  if (!access.ok) return json({ error: access.error }, access.status);
  const staff = access.staff;

  try {
    const [{ data, error }, { data: agreements, error: agreementError }, { data: connectedAssets, error: assetError }] = await Promise.all([
      supabaseAdmin.from("instrument_inventory").select("*").order("submitted_at", { ascending: false }),
      supabaseAdmin
        .from("portal_instrument_requests")
        .select("id, student_id, submitted_at, portal_students(display_name, grade_fall26)")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true }),
      supabaseAdmin.from("assets")
        .select("id,asset_tag,display_name,asset_instruments(instrument_type,brand,model,serial_number)")
        .eq("asset_type", "instrument")
        .eq("lifecycle_status", "active")
        .order("asset_tag", { ascending: true })
    ]);

    if (error || agreementError || assetError) return json({ error: "Could not load instrument inventory." }, 500);
    await logAudit({
      actor: staffActor(staff), action: "view_assignment_queue",
      table: "instrument_inventory,portal_instrument_requests", route: "/api/instrument-inventory/admin",
      changes: { inventory_count: (data || []).length, eligible_student_count: (agreements || []).length }
    });
    return json({ items: data || [], eligibleStudents: agreements || [], connectedAssets: connectedAssets || [] });
  } catch {
    return json({ error: "Could not load instrument inventory." }, 500);
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, review_status, action } = body;
    const capability = action === "assign"
      ? STAFF_CAPABILITIES.ASSETS_ASSIGN
      : STAFF_CAPABILITIES.ASSETS_WRITE;
    const access = await authorizeStaffRequest(req, capability);
    if (!access.ok) return json({ error: access.error }, access.status);
    const staff = access.staff;

    if (action === "link") {
      const canonicalAssetId = String(body.canonicalAssetId || "").trim();
      if (!id || !canonicalAssetId) return json({ error: "Observation and connected asset are required." }, 400);
      const [{ data: observation }, { data: asset }] = await Promise.all([
        supabaseAdmin.from("instrument_inventory").select("id,canonical_asset_id").eq("id", id).maybeSingle(),
        supabaseAdmin.from("assets").select("id,asset_tag,display_name").eq("id", canonicalAssetId).eq("asset_type", "instrument").eq("lifecycle_status", "active").maybeSingle(),
      ]);
      if (!observation || !asset) return json({ error: "Observation or connected instrument not found." }, 404);
      if (observation.canonical_asset_id && observation.canonical_asset_id !== asset.id) {
        return json({ error: "This observation is already matched. Review the existing match before changing it." }, 409);
      }
      const { error: linkError } = await supabaseAdmin.from("instrument_inventory").update({
        canonical_asset_id: asset.id,
        canonical_asset_linked_at: new Date().toISOString(),
        canonical_asset_linked_by_staff_id: staff.id,
      }).eq("id", id);
      if (linkError) return json({ error: "Could not match the connected instrument." }, 500);
      await logAudit({
        actor: staffActor(staff), action: "link_canonical_asset", table: "instrument_inventory",
        recordId: id, route: "/api/instrument-inventory/admin",
        changes: { canonical_asset_id: asset.id, asset_tag: asset.asset_tag },
      });
      return json({ ok: true, canonicalAssetId: asset.id });
    }

    if (action === "assign") {
      const requestId = String(body.requestId || "").trim();
      if (!id || !requestId) return json({ error: "Instrument and signed agreement are required." }, 400);
      const [{ data: agreement }, { data: observation }] = await Promise.all([
        supabaseAdmin
          .from("portal_instrument_requests")
          .select("id, student_id, status")
          .eq("id", requestId)
          .eq("status", "submitted")
          .maybeSingle(),
        supabaseAdmin
          .from("instrument_inventory")
          .select("id, canonical_asset_id")
          .eq("id", id)
          .maybeSingle(),
      ]);
      if (!agreement) return json({ error: "That agreement is no longer available." }, 409);
      if (!observation?.canonical_asset_id) {
        return json({ error: "Match this observation to a connected asset before assigning it." }, 409);
      }

      const now = new Date().toISOString();
      const { data: assignmentId, error: assignError } = await supabaseAdmin.rpc("assign_requested_instrument", {
        p_asset_id: observation.canonical_asset_id,
        p_student_id: agreement.student_id,
        p_request_id: agreement.id,
        p_actor_person_id: null,
        p_actor_staff_id: staff.id,
        p_source: "staff_assignment",
        p_condition: String(body.issuedCondition || "").trim(),
        p_notes: String(body.assignmentNotes || "").trim(),
      });
      if (assignError) return json({ error: "Could not assign the connected instrument." }, 409);

      // This observation remains a review record. The canonical assignment and
      // signed request were already updated atomically by the RPC above.
      await supabaseAdmin.from("instrument_inventory").update({
        assigned_student_id: agreement.student_id,
        instrument_request_id: agreement.id,
        issued_at: now,
        issued_by: staff.display_name,
        issued_condition: String(body.issuedCondition || "").trim(),
        assignment_notes: String(body.assignmentNotes || "").trim()
      }).eq("id", id);
      await logAudit({
        actor: staffActor(staff), action: "assign_instrument",
        table: "asset_assignments", recordId: assignmentId,
        route: "/api/instrument-inventory/admin",
        changes: {
          student_id: agreement.student_id,
          instrument_request_id: agreement.id,
          canonical_asset_id: observation.canonical_asset_id,
          observation_id: id,
        }
      });
      return json({ ok: true, assignmentId });
    }

    if (!id || !["reviewed", "verified", "rejected"].includes(review_status)) {
      return json({ error: "Valid id and review_status required" }, 400);
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

    if (error) return json({ error: "Could not update the instrument review." }, 500);
    await logAudit({
      actor: staffActor(staff), action: "update_review_status",
      table: "instrument_inventory", recordId: data.id,
      route: "/api/instrument-inventory/admin", changes: { review_status }
    });
    return json({ id: data.id, status: review_status });
  } catch {
    return json({ error: "Could not update the instrument inventory." }, 500);
  }
}
