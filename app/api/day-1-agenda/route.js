import { NextResponse } from "next/server";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import { DAY_1_AGENDA } from "@/lib/day1Agenda";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = await validateAttendanceRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Program PIN required." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  await logAudit({
    actor: session.actor,
    action: "day_1_agenda.read",
    table: "static_day_1_agenda",
    changes: { source_date: "2026-08-01", source_status: "review draft, not locked" },
    route: "/api/day-1-agenda"
  });

  return NextResponse.json(DAY_1_AGENDA, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
