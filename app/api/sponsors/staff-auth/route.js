import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPin } from "@/lib/sponsorAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createStaffCookieValue, setStaffCookie } from "@/lib/staffAuthCookie";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  if (!email || !pin) {
    return privateJson({ error: "Email and PIN are required" }, 400);
  }

  // Throttle PIN brute-force: 15 attempts / 15 min per email and per IP.
  const limit = await checkRateLimit({ key: `staff-auth:${email}`, limit: 15, windowMs: 15 * 60 * 1000 });
  const ipLimit = await checkRateLimit({ key: `staff-auth-ip:${clientIp(req)}`, limit: 30, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed || !ipLimit.allowed) {
    return privateJson({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);
  }
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, email, pin_hash, session_token, display_name, role")
    .eq("email", email)
    .maybeSingle();
  if (!data || !verifyPin(pin, data.pin_hash)) {
    return privateJson({ error: "Email or PIN not recognized" }, 401);
  }

  // One live server token per staff account. A successful login invalidates any
  // older cookie before issuing the new signed, httpOnly session.
  const sessionToken = crypto.randomUUID();
  const { data: rotated, error: rotateError } = await supabaseAdmin
    .from("staff")
    .update({ session_token: sessionToken })
    .eq("id", data.id)
    .eq("session_token", data.session_token)
    .select("id")
    .maybeSingle();
  if (rotateError || !rotated) {
    return privateServerError(
      "staff-auth",
      rotateError || new Error("Staff session changed during login."),
      "Staff sign-in is temporarily unavailable."
    );
  }

  // A staff session must only leave this route in an httpOnly cookie. Never
  // return the underlying database token to browser JavaScript.
  let cookieValue;
  try {
    cookieValue = createStaffCookieValue({ id: data.id, token: sessionToken });
  } catch {
    // Do not leave a reusable browser token exposed when cookie signing is unavailable.
    await supabaseAdmin.from("staff").update({ session_token: crypto.randomUUID() }).eq("id", data.id).eq("session_token", sessionToken);
    return privateJson({ error: "Staff sign-in is temporarily unavailable." }, 503);
  }

  const payload = { id: data.id, role: data.role, display_name: data.display_name };
  const res = privateJson(payload);
  setStaffCookie(res, cookieValue);
  return res;
}
