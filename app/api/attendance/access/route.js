import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPin } from "@/lib/sponsorAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  clearAttendanceCookie,
  createAttendanceCookieValue,
  setAttendanceCookie
} from "@/lib/attendanceAuth";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();
  if (!pin) return NextResponse.json({ error: "Enter the attendance PIN." }, { status: 400 });

  const limit = await checkRateLimit({
    key: `attendance-pin:${clientIp(request)}`,
    limit: 20,
    windowMs: 15 * 60 * 1000
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const { data: staffRows, error } = await supabaseAdmin
    .from("staff")
    .select("pin_hash");
  if (error) return NextResponse.json({ error: "Attendance access is temporarily unavailable." }, { status: 500 });

  const recognized = (staffRows || []).some((staff) => verifyPin(pin, staff.pin_hash));
  if (!recognized) return NextResponse.json({ error: "PIN not recognized." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  setAttendanceCookie(response, createAttendanceCookieValue());
  await logAudit({
    actor: { type: "system", name: "Shared attendance PIN" },
    action: "attendance.access.granted",
    table: "staff",
    route: "/api/attendance/access"
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAttendanceCookie(response);
  return response;
}
