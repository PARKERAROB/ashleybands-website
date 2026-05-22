import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalMagicLinkEmail } from "@/lib/portalEmail";
import { createMagicToken } from "@/lib/portalTokens";

export const runtime = "nodejs";

const MAGIC_LINK_MINUTES = 30;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { data: contacts, error } = await supabaseAdmin
    .from("portal_contact_methods")
    .select("id, person_id, value_normalized")
    .eq("contact_type", "email")
    .eq("value_normalized", email)
    .not("verification_status", "in", "(hard_bounce,replaced,superseded)");

  if (error) {
    return NextResponse.json({ error: "Portal lookup failed." }, { status: 500 });
  }

  if (!contacts?.length) {
    return NextResponse.json({ ok: true, status: "sent_if_known" });
  }

  const contact = contacts[0];
  const { token, tokenHash } = createMagicToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from("portal_magic_links")
    .insert({
      contact_method_id: contact.id,
      token_hash: tokenHash,
      purpose: "known_contact_login",
      email,
      expires_at: expiresAt,
      ip_created: request.headers.get("x-forwarded-for") || null,
      user_agent_created: request.headers.get("user-agent") || null
    });

  if (insertError) {
    return NextResponse.json({ error: "Could not create portal link." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const link = `${origin}/portal/review?token=${encodeURIComponent(token)}`;
  await sendPortalMagicLinkEmail({ to: email, link, expiresMinutes: MAGIC_LINK_MINUTES });

  return NextResponse.json({ ok: true, status: "sent_if_known" });
}
