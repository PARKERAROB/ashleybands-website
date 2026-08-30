import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert, sendPortalAccessGrantedEmail } from "@/lib/portalEmail";
import { hashCode, MAX_CODE_ATTEMPTS } from "@/lib/portalTokens";

export const runtime = "nodejs";

const BAD_CODE = "That code is incorrect or expired. Request a new one.";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  if (!email || !code) {
    return NextResponse.json({ error: "Enter your email and the code we sent." }, { status: 400 });
  }

  // Codes aren't unique, so look up the latest active row for this email+purpose
  // and compare the email-salted hash.
  const { data: link, error: linkLookupError } = await supabaseAdmin
    .from("portal_magic_links")
    .select("id, access_request_id, email, token_hash, code_attempts, expires_at")
    .eq("email", email)
    .eq("purpose", "unknown_email_confirm")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkLookupError) return NextResponse.json({ error: "Confirmation lookup failed." }, { status: 500 });
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

  // No approval gate (Rob 2026-06-23, extended 2026-07-05): a verified email that
  // matched a roster student gets a TRUSTED link immediately. The review queue is
  // an audit log. Only a request that matched NO roster student stays open, and
  // that is a family follow-up, not an approval.
  const granted = Boolean(accessRequest.claimed_student_id);
  await upsertStudentRelationship(accessRequest, person.id, granted ? "trusted" : "claimed");

  const requesterLabel = accessRequest.requester_type === "student" ? "Student" : "Guardian";
  const reviewSummary = granted
    ? `${accessRequest.guardian_name} verified a ${accessRequest.requester_type === "student" ? "student" : "guardian"} email and was auto-connected to ${accessRequest.student_first} ${accessRequest.student_last}.`
    : `${accessRequest.guardian_name} verified an email but no roster student matched ${accessRequest.student_first} ${accessRequest.student_last} - follow up.`;
  const { data: reviewItem, error: reviewError } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "email_verified_claim",
      status: granted ? "approved" : "needs_followup",
      student_id: accessRequest.claimed_student_id,
      person_id: person.id,
      access_request_id: accessRequest.id,
      summary: reviewSummary,
      details: {
        requester_type: accessRequest.requester_type || "guardian",
        guardian_name: accessRequest.guardian_name,
        guardian_email: accessRequest.guardian_email,
        guardian_phone: accessRequest.guardian_phone,
        claimed_student: `${accessRequest.student_first} ${accessRequest.student_last}`,
        student_grade: accessRequest.student_grade,
        instrument_or_note: accessRequest.instrument_or_note,
        match_confidence: accessRequest.match_confidence,
        contact_method_id: contact.id,
        ...(granted
          ? { reviewed_by: "auto-approve (roster match) 2026-07-05", reviewed_at: now }
          : {})
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
        status: granted ? "approved" : "email_verified",
        review_item_id: reviewItem.id
      })
      .eq("id", accessRequest.id)
  ]);
  if (linkUpdateError || accessUpdateError) {
    return NextResponse.json({ error: "Could not finalize confirmation." }, { status: 500 });
  }

  if (granted) {
    // Tell the family they are in; failure here must not fail the grant.
    try {
      await sendPortalAccessGrantedEmail({
        to: accessRequest.guardian_email,
        studentName: `${accessRequest.student_first} ${accessRequest.student_last}`,
        portalUrl: `${new URL(request.url).origin}/portal`
      });
    } catch {}
  }

  const reviewUrl = `${new URL(request.url).origin}/admin/profile-requests`;
  try {
    await sendPortalReviewAlert({
      subject: granted
        ? `Ashley Bands access granted (no action needed): ${accessRequest.student_first} ${accessRequest.student_last}`
        : `Ashley Bands follow-up needed (no roster match): ${accessRequest.student_first} ${accessRequest.student_last}`,
      summary: reviewSummary,
      reviewUrl,
      details: [
        `${requesterLabel}: ${accessRequest.guardian_name}`,
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

  return NextResponse.json({ ok: true, granted });
}

async function upsertClaimedPerson(accessRequest) {
  if (accessRequest.requester_type === "student" && accessRequest.claimed_student_id) {
    const { data: studentLink, error: studentLinkError } = await supabaseAdmin
      .from("portal_student_people")
      .select("person_id")
      .eq("student_id", accessRequest.claimed_student_id)
      .eq("role", "student")
      .eq("relationship_status", "trusted")
      .limit(1)
      .maybeSingle();
    if (studentLinkError) throw studentLinkError;
    if (studentLink?.person_id) return { id: studentLink.person_id };
  }
  const sourcePersonKey = `access-request:${accessRequest.id}`;
  const { data, error } = await supabaseAdmin
    .from("portal_people")
    .upsert({
      source_person_key: sourcePersonKey,
      person_type: accessRequest.requester_type === "student" ? "student" : "guardian",
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
      verification_status: "verified_email_code",
      verification_source: accessRequest.requester_type === "student" ? "portal_student_self_claim" : "portal_unknown_email_confirm",
      verified_at: now,
      evidence: {
        access_request_id: accessRequest.id,
        match_basis: "canonical_student_email"
      },
      source: "portal_access_request",
      source_row_hash: accessRequest.id,
      contact_purpose: accessRequest.requester_type === "student" ? "school" : "general"
    }, { onConflict: "person_id,contact_type,value_normalized" })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function upsertStudentRelationship(accessRequest, personId, relationshipStatus) {
  if (!accessRequest.claimed_student_id) return;
  await supabaseAdmin
    .from("portal_student_people")
    .upsert({
      student_id: accessRequest.claimed_student_id,
      person_id: personId,
      role: accessRequest.requester_type === "student" ? "student" : "guardian",
      relationship_status: relationshipStatus,
      primary_contact: false,
      source: "portal_access_request",
      source_row_hash: accessRequest.id,
      assurance_level: "high",
      trust_source: "canonical_student_email",
      assured_at: new Date().toISOString(),
      assured_by: "portal_email_code"
    }, { onConflict: "student_id,person_id" });
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || null, last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) };
}
