import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPin, verifyPin } from "@/lib/sponsorAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createStaffCookieValue, setStaffCookie } from "@/lib/staffAuthCookie";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Compared against when the email has no staff account, so response time does not reveal which
// addresses have one.
let unknownPinHash;
function unknownStaffPinHash() {
  unknownPinHash ||= hashPin(crypto.randomUUID());
  return unknownPinHash;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  if (!email || !pin) {
    return privateJson({ error: "Email and PIN are required" }, 400);
  }

  // Throttle PIN guessing. The strict limit pairs the address with the network, so one
  // stranger cannot lock a staff member out; a looser per-address ceiling still caps guessing
  // spread across many networks.
  const ip = clientIp(req);
  const windowMs = 15 * 60 * 1000;
  const limits = [
    { key: `staff-auth:${email}:${ip}`, limit: 15, windowMs },
    { key: `staff-auth-ip:${ip}`, limit: 30, windowMs },
    { key: `staff-auth-email:${email}`, limit: 60, windowMs }
  ];
  let allowed = true;
  for (const options of limits) {
    if (!(await checkRateLimit(options)).allowed) { allowed = false; break; }
  }
  if (!allowed) {
    return privateJson({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);
  }
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, email, pin_hash, session_token, display_name, role")
    .eq("email", email)
    .maybeSingle();
  const pinMatches = verifyPin(pin, data?.pin_hash || unknownStaffPinHash());
  if (!data || !pinMatches) {
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
