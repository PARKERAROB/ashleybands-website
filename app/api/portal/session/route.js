import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPortalSession, hashToken, setPortalSessionCookie } from "@/lib/portalTokens";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing portal token." }, { status: 400 });
  }

  const { data: link, error } = await supabaseAdmin
    .from("portal_magic_links")
    .select("id, contact_method_id, email, expires_at, consumed_at, portal_contact_methods(person_id)")
    .eq("token_hash", hashToken(token))
    .eq("purpose", "known_contact_login")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Portal token lookup failed." }, { status: 500 });
  }
  if (!link || link.consumed_at || new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This profile link is expired or has already been used." }, { status: 401 });
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
        verification_status: "verified_magic_link",
        verification_source: "portal_magic_link",
        verified_at: now
      })
      .eq("id", link.contact_method_id)
      .eq("verification_status", "unverified")
  ]);

  if (linkError || contactError) {
    return NextResponse.json({ error: "Could not verify portal link." }, { status: 500 });
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
