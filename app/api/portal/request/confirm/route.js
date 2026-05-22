import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { hashToken } from "@/lib/portalTokens";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing confirmation token." }, { status: 400 });
  }

  const { data: link, error: linkLookupError } = await supabaseAdmin
    .from("portal_magic_links")
    .select("id, access_request_id, email, expires_at, consumed_at")
    .eq("token_hash", hashToken(token))
    .eq("purpose", "unknown_email_confirm")
    .maybeSingle();

  if (linkLookupError) return NextResponse.json({ error: "Confirmation lookup failed." }, { status: 500 });
  if (!link || link.consumed_at || new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This confirmation link is expired or has already been used." }, { status: 401 });
  }

  const { data: accessRequest, error: accessError } = await supabaseAdmin
    .from("portal_access_requests")
    .select("*")
    .eq("id", link.access_request_id)
    .maybeSingle();
  if (accessError || !accessRequest) {
    return NextResponse.json({ error: "Access request not found." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const person = await upsertClaimedPerson(accessRequest);
  const contact = await upsertVerifiedEmail(person.id, accessRequest, now);
  await maybeCreateClaimedRelationship(accessRequest, person.id);

  const reviewSummary = `${accessRequest.guardian_name} verified an email and requested access for ${accessRequest.student_first} ${accessRequest.student_last}.`;
  const { data: reviewItem, error: reviewError } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "email_verified_claim",
      status: "email_verified",
      student_id: accessRequest.claimed_student_id,
      person_id: person.id,
      access_request_id: accessRequest.id,
      summary: reviewSummary,
      details: {
        guardian_name: accessRequest.guardian_name,
        guardian_email: accessRequest.guardian_email,
        guardian_phone: accessRequest.guardian_phone,
        claimed_student: `${accessRequest.student_first} ${accessRequest.student_last}`,
        student_grade: accessRequest.student_grade,
        instrument_or_note: accessRequest.instrument_or_note,
        match_confidence: accessRequest.match_confidence,
        contact_method_id: contact.id
      }
    })
    .select("id")
    .single();
  if (reviewError) return NextResponse.json({ error: "Could not create review item." }, { status: 500 });

  const [{ error: linkUpdateError }, { error: accessUpdateError }] = await Promise.all([
    supabaseAdmin
      .from("portal_magic_links")
      .update({
        consumed_at: now,
        ip_consumed: request.headers.get("x-forwarded-for") || null,
        user_agent_consumed: request.headers.get("user-agent") || null
      })
      .eq("id", link.id),
    supabaseAdmin
      .from("portal_access_requests")
      .update({
        email_verified_at: now,
        claimed_person_id: person.id,
        status: "email_verified",
        review_item_id: reviewItem.id
      })
      .eq("id", accessRequest.id)
  ]);
  if (linkUpdateError || accessUpdateError) {
    return NextResponse.json({ error: "Could not finalize confirmation." }, { status: 500 });
  }

  const reviewUrl = `${new URL(request.url).origin}/admin/profile-requests`;
  try {
    await sendPortalReviewAlert({
      subject: `Ashley Bands profile review needed: ${accessRequest.student_first} ${accessRequest.student_last}`,
      summary: reviewSummary,
      reviewUrl,
      details: [
        `Guardian: ${accessRequest.guardian_name}`,
        `Email: ${accessRequest.guardian_email}`,
        `Phone: ${accessRequest.guardian_phone || "not provided"}`,
        `Claimed student: ${accessRequest.student_first} ${accessRequest.student_last}`,
        `Grade: ${accessRequest.student_grade || "not provided"}`,
        `Match confidence: ${accessRequest.match_confidence || "none"}`
      ]
    });
    await supabaseAdmin
      .from("portal_review_queue")
      .update({ email_alert_status: "sent", email_alert_sent_at: new Date().toISOString() })
      .eq("id", reviewItem.id);
  } catch (error) {
    await supabaseAdmin
      .from("portal_review_queue")
      .update({ email_alert_status: "failed", email_alert_error: error.message })
      .eq("id", reviewItem.id);
  }

  return NextResponse.json({ ok: true });
}

async function upsertClaimedPerson(accessRequest) {
  const sourcePersonKey = `access-request:${accessRequest.id}`;
  const { data, error } = await supabaseAdmin
    .from("portal_people")
    .upsert({
      source_person_key: sourcePersonKey,
      person_type: "guardian",
      display_name: accessRequest.guardian_name,
      first_name: splitName(accessRequest.guardian_name).first,
      last_name: splitName(accessRequest.guardian_name).last,
      source: "portal_access_request",
      source_row_hash: accessRequest.id
    }, { onConflict: "source_person_key" })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function upsertVerifiedEmail(personId, accessRequest, now) {
  const { data, error } = await supabaseAdmin
    .from("portal_contact_methods")
    .upsert({
      person_id: personId,
      contact_type: "email",
      value_display: accessRequest.guardian_email,
      value_normalized: accessRequest.guardian_email.toLowerCase(),
      verification_status: "verified_magic_link",
      verification_source: "portal_unknown_email_confirm",
      verified_at: now,
      evidence: {
        access_request_id: accessRequest.id,
        claimed_student: `${accessRequest.student_first} ${accessRequest.student_last}`
      },
      source: "portal_access_request",
      source_row_hash: accessRequest.id
    }, { onConflict: "person_id,contact_type,value_normalized" })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function maybeCreateClaimedRelationship(accessRequest, personId) {
  if (!accessRequest.claimed_student_id) return;
  await supabaseAdmin
    .from("portal_student_people")
    .upsert({
      student_id: accessRequest.claimed_student_id,
      person_id: personId,
      role: "claimed guardian",
      relationship_status: "claimed",
      primary_contact: false,
      source: "portal_access_request",
      source_row_hash: accessRequest.id
    }, { onConflict: "student_id,person_id" });
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || null, last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) };
}
