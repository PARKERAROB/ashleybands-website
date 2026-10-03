import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { normalizeRehearsalCode } from "@/lib/ascendCheck.mjs";
import { loadAscendDay } from "@/lib/ascendCheckServer";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
const ROUTE = "/api/admin/ascend-check";

// Staff view of one rehearsal date plus the rehearsal code (#172). The code is only ever
// returned here; the public read in app/api/ascend-check never includes it.
export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ASCEND_CHECK_MANAGE);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);

  let day;
  let setting;
  try {
    [day, setting] = await Promise.all([
      loadAscendDay(request.nextUrl.searchParams.get("date")),
      supabaseAdmin.from("ascend_self_check_settings").select("rehearsal_code,updated_at").eq("id", 1).maybeSingle(),
    ]);
    if (setting.error) throw new Error(setting.error.message);
  } catch (error) {
    console.error("[ascend-check] staff load failed:", error.message);
    return json({ error: "The self checks could not be loaded." }, 503);
  }
  void logAudit({
    actor: staffActor(authorization.staff),
    action: "ascend_check.view",
    table: "ascend_self_checks",
    recordId: day.date,
    changes: { submissions: day.submissions.length },
    route: ROUTE,
  });
  return json({
    ...day,
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
