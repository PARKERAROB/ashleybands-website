import { NextResponse } from "next/server";
import { verifyPin } from "@/lib/sponsorAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  clearRegimentOsCookie,
  createRegimentOsCookieValue,
  setRegimentOsCookie
} from "@/lib/regimentOsAuth";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();
  if (!pin) return NextResponse.json({ error: "Enter the program PIN." }, { status: 400 });

  const limit = await checkRateLimit({
    key: `regiment-os-pin:${clientIp(request)}`,
    limit: 20,
    windowMs: 15 * 60 * 1000
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  const pinHash = process.env.ATTENDANCE_PIN_HASH;
  if (!pinHash) {
    return NextResponse.json({ error: "Program access is not configured." }, { status: 503 });
  }
  if (!verifyPin(pin, pinHash)) {
    return NextResponse.json({ error: "PIN not recognized." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setRegimentOsCookie(response, createRegimentOsCookieValue());
  await logAudit({
    actor: { type: "system", name: "Shared Regiment OS PIN" },
    action: "regiment_os.access.granted",
    table: "regiment_os_access",
    route: "/api/regiment-os/access"
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearRegimentOsCookie(response);
  return response;
}
