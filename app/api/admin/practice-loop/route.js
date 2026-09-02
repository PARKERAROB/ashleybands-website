import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { BERNSTEIN_PIECE_KEY } from "@/lib/practiceLoop.mjs";

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
    const { data, error } = await supabaseAdmin
      .from("practice_loop_prototype_submissions")
      .select("id,display_name,instrument,marks,created_at,updated_at")
      .eq("piece_key", BERNSTEIN_PIECE_KEY)
      .order("display_name", { ascending: true });
    if (error) throw error;

    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "practice_loop.prototype.view",
      table: "practice_loop_prototype_submissions",
      recordId: BERNSTEIN_PIECE_KEY,
      changes: { participant_count: (data || []).length },
      route: "/api/admin/practice-loop",
    });

    return json({ submissions: data || [] });
  } catch (error) {
    console.error("[practice-loop] dashboard load failed:", error?.message || error);
    return json({ error: "The practice dashboard could not be loaded or durably attributed." }, 503);
  }
}
