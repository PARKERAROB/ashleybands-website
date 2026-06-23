import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

// AUTO-APPROVE (Rob 2026-06-23): a TRUSTED guardian adding a family guardian is authorized by their own
// login, so there is no manual gate. We provision the new guardian directly — resolve or create the
// person, add their contact methods, and grant a TRUSTED student link — then log it for audit and notify
// Rob. The new guardian logs in via a magic link to the email on file.
// See docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md
export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const name = String(body.name || "").trim().slice(0, 200);
  const phone = String(body.phone || "").trim().slice(0, 50);
  const email = String(body.email || "").trim().slice(0, 200);
  const relationship = String(body.relationship || "").trim().slice(0, 100);

  if (!studentId) return NextResponse.json({ error: "Pick which student this guardian belongs to." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter the guardian's name." }, { status: 400 });
  if (!phone && !email) {
    return NextResponse.json({ error: "Enter a phone or email for the guardian." }, { status: 400 });
  }

  const { data: link } = await supabaseAdmin
    .from("portal_student_people")
    .select("id, portal_students(display_name)")
    .eq("person_id", session.personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "Student access not found." }, { status: 403 });

  const studentName = link.portal_students?.display_name || "this student";
  const emailNorm = email.toLowerCase();
  const phoneNorm = phone.replace(/[^0-9]/g, "");
  const nowIso = new Date().toISOString();
  const newValue = JSON.stringify({ name, phone, email, relationship });
  const summary = `${session.email} added a guardian for ${studentName}: ${name}`;

  // 1) Resolve an existing person by email, then phone (avoid duplicates).
  let personId = null;
  if (emailNorm) {
    const { data: cm } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("person_id")
      .eq("contact_type", "email")
      .eq("value_normalized", emailNorm)
      .limit(1)
      .maybeSingle();
    if (cm) personId = cm.person_id;
  }
  if (!personId && phoneNorm) {
    const { data: cm } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("person_id")
      .eq("contact_type", "phone")
      .eq("value_normalized", phoneNorm)
      .limit(1)
      .maybeSingle();
    if (cm) personId = cm.person_id;
  }

  // 2) Create the person + contact methods if new.
  if (!personId) {
    const parts = name.split(/\s+/);
    const { data: person, error: personError } = await supabaseAdmin
      .from("portal_people")
      .insert({
        source_person_key: `self-add:${emailNorm || phoneNorm}:${studentId}`,
        person_type: "guardian",
        display_name: name,
        first_name: parts[0] || name,
        last_name: parts.length > 1 ? parts[parts.length - 1] : "",
        source: "portal_self_add"
      })
      .select("id")
      .single();
    if (personError) return NextResponse.json({ error: "Could not create the guardian." }, { status: 500 });
    personId = person.id;
    if (emailNorm) {
      await supabaseAdmin.from("portal_contact_methods").insert({
        person_id: personId, contact_type: "email",
        value_display: email, value_normalized: emailNorm,
        verification_status: "unverified", verification_source: "portal_self_add"
      });
    }
    if (phoneNorm) {
      await supabaseAdmin.from("portal_contact_methods").insert({
        person_id: personId, contact_type: "phone",
        value_display: phone, value_normalized: phoneNorm,
        verification_status: "unverified", verification_source: "portal_self_add"
      });
    }
  }

  // 3) Grant the TRUSTED student link (flip an existing link, or create one).
  const { data: existingLink } = await supabaseAdmin
    .from("portal_student_people")
    .select("id")
    .eq("student_id", studentId)
    .eq("person_id", personId)
    .maybeSingle();
  if (existingLink) {
    await supabaseAdmin
      .from("portal_student_people")
      .update({ relationship_status: "trusted", role: relationship || null, updated_at: nowIso })
      .eq("id", existingLink.id);
  } else {
    const { error: linkError } = await supabaseAdmin.from("portal_student_people").insert({
      student_id: studentId, person_id: personId,
      relationship_status: "trusted", role: relationship || null,
      primary_contact: false, source: "portal_self_add"
    });
    if (linkError) return NextResponse.json({ error: "Could not grant access." }, { status: 500 });
  }

  // 4) Audit log: an approved update_request + review_queue entry (the queue is an audit log now).
  const { data: updateRequest } = await supabaseAdmin
    .from("portal_update_requests")
    .insert({
      submitted_by_person_id: session.personId,
      student_id: studentId,
      target_table: "portal_people",
      target_id: personId,
      field_name: "add_guardian",
      old_value: "",
      new_value: newValue,
      sensitivity: "relationship",
      status: "approved",
      reviewed_by: "auto-approve (login-authorized) 2026-06-23",
      reviewed_at: nowIso,
      review_notes: "Auto-provisioned: a trusted guardian added a family guardian."
    })
    .select("id")
    .single();

  const { data: reviewItem } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "guardian_claim",
      status: "approved",
      student_id: studentId,
      person_id: session.personId,
      update_request_id: updateRequest?.id || null,
      summary,
      details: {
        field: "add_guardian",
        label: "New guardian (auto-approved)",
        student: studentName,
        guardian_name: name,
        guardian_phone: phone,
        guardian_email: email,
        relationship,
        submitted_by_email: session.email,
        auto_approved: true,
        granted_person_id: personId
      }
    })
    .select("id")
    .single();

  if (updateRequest?.id && reviewItem?.id) {
    await supabaseAdmin
      .from("portal_update_requests")
      .update({ review_item_id: reviewItem.id })
      .eq("id", updateRequest.id);
  }

  // 5) Notify Rob (oversight audit) — best-effort; the grant + audit row already persisted.
  try {
    await sendPortalReviewAlert({
      subject: `Ashley Bands guardian auto-added: ${name}`,
      summary,
      reviewUrl: `${new URL(request.url).origin}/admin/profile-requests`,
      details: [
        `Auto-approved (parent login-authorized).`,
        `Submitted by: ${session.email}`,
        `Student: ${studentName}`,
        `Guardian: ${name}`,
        relationship ? `Relationship: ${relationship}` : "",
        phone ? `Phone: ${phone}` : "",
        email ? `Email: ${email}` : ""
      ]
    });
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, granted: true });
}
