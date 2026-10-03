import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPortalSession, hashCode, readPortalSession, setPortalSessionCookie, MAX_CODE_ATTEMPTS } from "@/lib/portalTokens";
import { PORTAL_TROUBLE_MESSAGE } from "@/lib/portalFamilyMessages";
import { checkPortalCode } from "@/lib/portalCodeCheck.mjs";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const BAD_CODE = "That code is incorrect or expired. Request a new one.";

// Lightweight signed-in check for the site header.
export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ signedIn: false });
  }
  const { data: person } = await supabaseAdmin
    .from("portal_people")
    .select("display_name")
    .eq("id", session.personId)
    .maybeSingle();
  const displayName = person?.display_name || session.email || "";
  const firstName = displayName.trim().split(/\s+/)[0] || "";
  return NextResponse.json({ signedIn: true, firstName, email: session.email });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!email || !code) {
    return NextResponse.json({ error: "Enter your email and the code we sent." }, { status: 400 });
  }

  const windowMs = 15 * 60 * 1000;
  const emailLimit = await checkRateLimit({ key: `portal-session:${email}`, limit: 30, windowMs, failOpen: false });
  const ipLimit = emailLimit.allowed
    ? await checkRateLimit({ key: `portal-session-ip:${clientIp(request)}`, limit: 240, windowMs, failOpen: false })
    : emailLimit;
  if (!emailLimit.allowed || !ipLimit.allowed) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes, then request a new code." }, { status: 429 });
  }

  // Codes aren't unique, so look up the latest active row for this email+purpose
  // and compare the email-salted hash. (No token in the URL to detonate.)
  const { data: link, error } = await supabaseAdmin
    .from("portal_magic_links")
    .select("id, contact_method_id, email, token_hash, code_attempts, expires_at, portal_contact_methods(person_id)")
    .eq("email", email)
    .eq("purpose", "known_contact_login")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[portal-session] code lookup failed:", error.message);
    return NextResponse.json({ error: PORTAL_TROUBLE_MESSAGE }, { status: 500 });
  }
  if (!link || new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: BAD_CODE }, { status: 401 });
  }

  const personId = link.portal_contact_methods?.person_id;
  if (!personId) {
    console.error("[portal-session] contact method is not linked to a person:", link.contact_method_id);
    return NextResponse.json({ error: PORTAL_TROUBLE_MESSAGE }, { status: 500 });
  }

  let accepted;
  try {
    accepted = await checkPortalCode(supabaseAdmin, link, {
      maxAttempts: MAX_CODE_ATTEMPTS,
      matches: () => link.token_hash === hashCode(email, code),
      consumePatch: {
        ip_consumed: request.headers.get("x-forwarded-for") || null,
        user_agent_consumed: request.headers.get("user-agent") || null
      }
    });
  } catch (checkError) {
    console.error("[portal-session] code check failed:", checkError?.message || checkError);
    return NextResponse.json({ error: PORTAL_TROUBLE_MESSAGE }, { status: 500 });
  }
  if (!accepted) {
    return NextResponse.json({ error: BAD_CODE }, { status: 401 });
  }

  const { error: contactError } = await supabaseAdmin
    .from("portal_contact_methods")
    .update({
      verification_status: "verified_email_code",
      verification_source: "portal_email_code",
      verified_at: new Date().toISOString()
    })
    .eq("id", link.contact_method_id)
    .eq("verification_status", "unverified");

  if (contactError) {
    console.error("[portal-session] code consume failed:", contactError.message);
    return NextResponse.json({ error: PORTAL_TROUBLE_MESSAGE }, { status: 500 });
  }

  const session = createPortalSession({
    personId,
    contactMethodId: link.contact_method_id,
    email: link.email
  });
  const response = NextResponse.json({ ok: true });
  setPortalSessionCookie(response, session);
  return response;
}
