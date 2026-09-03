import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import {
  DEFAULT_PRACTICE_PIECE_SLUG,
  getPracticePiece,
  normalizePracticeDisplayName,
} from "@/lib/practiceLoop.mjs";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

export async function GET(request) {
  const authorization = await authorizeStaffRequest(
    request,
    STAFF_CAPABILITIES.SYSTEM_OVERSIGHT_READ,
  );
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);

  try {
    const piece = getPracticePiece(
      request.nextUrl.searchParams.get("piece") || DEFAULT_PRACTICE_PIECE_SLUG,
    );
    if (!piece) return json({ error: "Choose a valid practice piece." }, 400);

    const { data, error } = await supabaseAdmin
      .from("practice_loop_prototype_submissions")
      .select("id,display_name,instrument,marks,created_at,updated_at")
      .eq("piece_key", piece.key)
      .is("removed_at", null)
      .order("display_name", { ascending: true });
    if (error) throw error;

    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "practice_loop.prototype.view",
      table: "practice_loop_prototype_submissions",
      recordId: piece.key,
      changes: { participant_count: (data || []).length },
      route: "/api/admin/practice-loop",
    });

    return json({ pieceSlug: piece.slug, submissions: data || [] });
  } catch (error) {
    console.error("[practice-loop] dashboard load failed:", error?.message || error);
    return json({ error: "The practice dashboard could not be loaded or durably attributed." }, 503);
  }
}

export async function PATCH(request) {
  const authorization = await authorizeStaffRequest(
    request,
    STAFF_CAPABILITIES.PRACTICE_LOOP_MANAGE,
  );
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);

  try {
    const body = await request.json().catch(() => ({}));
    const submissionId = String(body.submissionId || "").trim();
    const action = String(body.action || "").trim();
    const piece = getPracticePiece(body.pieceSlug || DEFAULT_PRACTICE_PIECE_SLUG);
    if (!piece) return json({ error: "Choose a valid practice piece." }, 400);
    if (!submissionId || !["rename", "remove"].includes(action)) {
      return json({ error: "Choose a valid student and action." }, 400);
    }
    const displayName = action === "rename"
      ? normalizePracticeDisplayName(body.displayName)
      : null;
    const { error } = await supabaseAdmin.rpc("manage_practice_loop_submission_with_audit", {
      p_submission_id: submissionId,
      p_piece_key: piece.key,
      p_action: action,
      p_display_name: displayName,
      p_actor_staff_id: authorization.staff.id,
      p_route: "/api/admin/practice-loop",
    });
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    console.error("[practice-loop] student management failed:", error?.message || error);
    return json({ error: error?.message?.includes("student name")
      ? "Enter a student name."
      : "That student change could not be completed." }, 400);
  }
}
