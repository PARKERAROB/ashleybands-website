import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { normalizeRehearsalCode, rehearsalDate } from "@/lib/ascendCheck.mjs";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
const ROUTE = "/api/admin/ascend-check";

// Staff view of student self checks for one rehearsal date (#172). Aggregation runs in the
// browser from lib/ascendCheck.mjs so filters do not need another request.
export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ASCEND_CHECK_MANAGE);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);

  const asked = request.nextUrl.searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : rehearsalDate();
  const [rows, dates, setting] = await Promise.all([
    supabaseAdmin.from("ascend_self_checks")
      .select("drill_number,payload,updated_at")
      .eq("rehearsal_date", date)
      .order("drill_number"),
    // ponytail: pulls every date's row stub; fine for one season, page it if it grows past a few thousand.
    supabaseAdmin.from("ascend_self_checks").select("rehearsal_date").order("rehearsal_date", { ascending: false }),
    supabaseAdmin.from("ascend_self_check_settings").select("rehearsal_code,updated_at").eq("id", 1).maybeSingle(),
  ]);
  const failed = rows.error || dates.error || setting.error;
  if (failed) {
    console.error("[ascend-check] staff load failed:", failed.message);
    return json({ error: "The self checks could not be loaded." }, 503);
  }
  void logAudit({
    actor: staffActor(authorization.staff),
    action: "ascend_check.view",
    table: "ascend_self_checks",
    recordId: date,
    changes: { submissions: rows.data.length },
    route: ROUTE,
  });
  const counts = {};
  for (const { rehearsal_date: d } of dates.data) counts[d] = (counts[d] || 0) + 1;
  return json({
    date,
    submissions: rows.data,
    dates: Object.entries(counts).map(([value, count]) => ({ value, count })),
    code: setting.data?.rehearsal_code || "",
    codeUpdatedAt: setting.data?.updated_at || null,
  });
}

// Set the one shared rehearsal code students type before sending.
export async function PUT(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ASCEND_CHECK_MANAGE);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);

  const body = await request.json().catch(() => ({}));
  const code = normalizeRehearsalCode(body.code);
  if (code.length < 3) return json({ error: "Use at least 3 letters or numbers for the code." }, 400);
  const { error } = await supabaseAdmin.from("ascend_self_check_settings").upsert({
    id: 1,
    rehearsal_code: code,
    updated_by: String(authorization.staff.id),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[ascend-check] code save failed:", error.message);
    return json({ error: "The code could not be saved." }, 503);
  }
  await logAudit({
    actor: staffActor(authorization.staff),
    action: "ascend_check.code.set",
    table: "ascend_self_check_settings",
    recordId: "1",
    route: ROUTE,
  });
  return json({ ok: true, code });
}
