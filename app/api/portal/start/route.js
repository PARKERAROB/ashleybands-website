import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalCodeEmail } from "@/lib/portalEmail";
import { createNumericCode, hashCode } from "@/lib/portalTokens";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const CODE_MINUTES = 15;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Throttle code spam per address. The IP ceiling is intentionally high enough
  // for Open House, where many families can share the school's public address.
  // The per-email cap remains the primary protection against targeted spam.
  const emailLimit = await checkRateLimit({ key: `portal-start:${email}`, limit: 6, windowMs: 15 * 60 * 1000 });
  const ipLimit = await checkRateLimit({ key: `portal-start-ip:${clientIp(request)}`, limit: 120, windowMs: 15 * 60 * 1000 });
  if (!emailLimit.allowed || !ipLimit.allowed) {
    // Mirror the existing privacy-preserving response shape.
    return NextResponse.json({ ok: true, status: "sent_if_known" });
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
  const code = createNumericCode();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString();

  // Supersede any earlier un-consumed login codes for this email so the verify
  // step has exactly one active row to check.
  await supabaseAdmin
    .from("portal_magic_links")
    .update({ consumed_at: now })
    .eq("email", email)
    .eq("purpose", "known_contact_login")
    .is("consumed_at", null);

  const { error: insertError } = await supabaseAdmin
    .from("portal_magic_links")
    .insert({
      contact_method_id: contact.id,
      token_hash: hashCode(email, code),
      purpose: "known_contact_login",
      email,
      expires_at: expiresAt,
      ip_created: request.headers.get("x-forwarded-for") || null,
      user_agent_created: request.headers.get("user-agent") || null
    });

  if (insertError) {
    return NextResponse.json({ error: "Could not create sign-in code." }, { status: 500 });
  }

  try {
    await sendPortalCodeEmail({ to: email, code, expiresMinutes: CODE_MINUTES });
  } catch (sendError) {
    // Do not leave an undelivered code active. Keep the public response
    // indistinguishable from an unknown email to avoid exposing the roster.
    await supabaseAdmin
      .from("portal_magic_links")
      .update({ consumed_at: new Date().toISOString() })
      .eq("token_hash", hashCode(email, code));
    console.error("Portal sign-in code email failed to send.", sendError);
  }

  return NextResponse.json({ ok: true, status: "sent_if_known" });
}
