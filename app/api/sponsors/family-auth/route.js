import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPin, verifyPin } from "@/lib/sponsorAuth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { createFamilyCookieValue, setFamilyCookie } from "@/lib/familyAuthCookie";
import { sponsorLegacyPinLive } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

function bad(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// Issue a session: set the httpOnly cookie, and (for backward compat with the
// localStorage client) also return id/token unless the cookie was set, mirroring
// the staff-auth rollout. The cookie is the secure path; the token fallback keeps
// existing sessions working and avoids any lockout if the secret is unset.
function issueSession(fam) {
  let cookieValue = null;
  try {
    cookieValue = createFamilyCookieValue({ id: fam.id, token: fam.session_token });
  } catch {
    cookieValue = null;
  }
  const payload = { id: fam.id, display_name: fam.display_name };
  if (!cookieValue) payload.token = fam.session_token;
  const res = NextResponse.json(payload);
  if (cookieValue) setFamilyCookie(res, cookieValue);
  return res;
}

export async function POST(req) {
  if (!sponsorLegacyPinLive()) {
    return bad("Use the Family Portal to open sponsorship.", 404);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const mode = body.mode === "signup" ? "signup" : "login";
  const displayName = String(body.display_name || "").trim();
  const pin = String(body.pin || "").trim();

  if (!displayName || !/^\d{4}$/.test(pin)) {
    return bad("Family name and a 4-digit PIN are required.");
  }

  // Throttle PIN guessing: 10 attempts / 15 min per family name, 30 / 15 min per IP.
  // 4-digit PINs are only safe behind a rate limit, which family-auth previously lacked.
  const nameLimit = await checkRateLimit({
    key: `family-auth:${displayName.toLowerCase()}`,
    limit: 10,
    windowMs: 15 * 60 * 1000
  });
  const ipLimit = await checkRateLimit({
    key: `family-auth-ip:${clientIp(req)}`,
    limit: 30,
    windowMs: 15 * 60 * 1000
  });
  if (!nameLimit.allowed || !ipLimit.allowed) {
    return bad("Too many attempts. Please wait a few minutes and try again.", 429);
  }

  if (mode === "signup") {
    const { data: existing } = await supabaseAdmin
      .from("families")
      .select("id")
      .ilike("display_name", displayName)
      .maybeSingle();
    if (existing) {
      return bad("A family with that name already exists. Use Log In instead.");
    }
    const insert = {
      display_name: displayName,
      pin_hash: hashPin(pin),
      student_first: String(body.student_first || "").trim() || null,
      student_last: String(body.student_last || "").trim() || null,
      section: String(body.section || "").trim() || null
    };
    const { data, error } = await supabaseAdmin
      .from("families")
      .insert(insert)
      .select("id, session_token, display_name")
      .single();
    if (error) return bad(error.message, 500);
    return issueSession(data);
  }

  // login
  const { data: fam } = await supabaseAdmin
    .from("families")
    .select("id, pin_hash, session_token, display_name")
    .ilike("display_name", displayName)
    .maybeSingle();
  if (!fam || !verifyPin(pin, fam.pin_hash)) {
    return bad("Family name or PIN not recognized.", 401);
  }
  return issueSession(fam);
}
