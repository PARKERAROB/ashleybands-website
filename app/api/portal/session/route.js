import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPortalSession, hashCode, readPortalSession, setPortalSessionCookie, MAX_CODE_ATTEMPTS } from "@/lib/portalTokens";

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
    return NextResponse.json({ error: "Portal code lookup failed." }, { status: 500 });
  }
  if (!link || new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: BAD_CODE }, { status: 401 });
  }

  if (link.token_hash !== hashCode(email, code)) {
    const attempts = (link.code_attempts || 0) + 1;
    const lock = attempts >= MAX_CODE_ATTEMPTS;
    await supabaseAdmin
      .from("portal_magic_links")
      .update({ code_attempts: attempts, ...(lock ? { consumed_at: new Date().toISOString() } : {}) })
      .eq("id", link.id);
    return NextResponse.json({ error: BAD_CODE }, { status: 401 });
  }

  const personId = link.portal_contact_methods?.person_id;
  if (!personId) {
    return NextResponse.json({ error: "Portal contact is not linked to a person." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const [{ error: linkError }, { error: contactError }] = await Promise.all([
    supabaseAdmin
      .from("portal_magic_links")
      .update({
        consumed_at: now,
        ip_consumed: request.headers.get("x-forwarded-for") || null,
        user_agent_consumed: request.headers.get("user-agent") || null
      })
      .eq("id", link.id),
    supabaseAdmin
      .from("portal_contact_methods")
      .update({
        verification_status: "verified_email_code",
        verification_source: "portal_email_code",
        verified_at: now
      })
      .eq("id", link.contact_method_id)
      .eq("verification_status", "unverified")
  ]);

  if (linkError || contactError) {
    return NextResponse.json({ error: "Could not verify the code." }, { status: 500 });
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
