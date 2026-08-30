import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPin } from "@/lib/sponsorAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createStaffCookieValue, setStaffCookie } from "@/lib/staffAuthCookie";

export const runtime = "nodejs";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  if (!email || !pin) {
    return NextResponse.json({ error: "Email and PIN are required" }, { status: 400 });
  }

  // Throttle PIN brute-force: 15 attempts / 15 min per email and per IP.
  const limit = await checkRateLimit({ key: `staff-auth:${email}`, limit: 15, windowMs: 15 * 60 * 1000 });
  const ipLimit = await checkRateLimit({ key: `staff-auth-ip:${clientIp(req)}`, limit: 30, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed || !ipLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes and try again." }, { status: 429 });
  }
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, email, pin_hash, session_token, display_name, role")
    .eq("email", email)
    .maybeSingle();
  if (!data || !verifyPin(pin, data.pin_hash)) {
    return NextResponse.json({ error: "Email or PIN not recognized" }, { status: 401 });
  }

  // A staff session must only leave this route in an httpOnly cookie. Never
  // return the underlying database token to browser JavaScript.
  let cookieValue;
  try {
    cookieValue = createStaffCookieValue({ id: data.id, token: data.session_token });
  } catch {
    return NextResponse.json(
      { error: "Staff sign-in is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const payload = { id: data.id, role: data.role, display_name: data.display_name };
  const res = NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  setStaffCookie(res, cookieValue);
  return res;
}
