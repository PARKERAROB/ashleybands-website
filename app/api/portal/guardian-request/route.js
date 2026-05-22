import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

// Adding a guardian creates a new person + relationship, so it does NOT write
// the mirror directly. It queues a review request for Rob to add into the
// canonical CSV; the sync then brings the new guardian into the mirror.
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
  const newValue = JSON.stringify({ name, phone, email, relationship });
  const summary = `${session.email} wants to add a guardian for ${studentName}: ${name}`;

  const { data: updateRequest, error: updateError } = await supabaseAdmin
    .from("portal_update_requests")
    .insert({
      submitted_by_person_id: session.personId,
      student_id: studentId,
      target_table: "portal_people",
      target_id: null,
      field_name: "add_guardian",
      old_value: "",
      new_value: newValue,
      sensitivity: "relationship",
      status: "needs_review"
    })
    .select("id")
    .single();

  if (updateError) return NextResponse.json({ error: "Could not stage the guardian request." }, { status: 500 });

  const { data: reviewItem, error: reviewError } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "guardian_claim",
      status: "needs_review",
      student_id: studentId,
      person_id: session.personId,
      update_request_id: updateRequest.id,
      summary,
      details: {
        field: "add_guardian",
        label: "New guardian",
        student: studentName,
        guardian_name: name,
        guardian_phone: phone,
        guardian_email: email,
        relationship,
        submitted_by_email: session.email,
        mirror_applied: false
      }
    })
    .select("id")
    .single();

  if (reviewError) return NextResponse.json({ error: "Could not create review item." }, { status: 500 });

  await supabaseAdmin
    .from("portal_update_requests")
    .update({ review_item_id: reviewItem.id })
    .eq("id", updateRequest.id);

  const reviewUrl = `${new URL(request.url).origin}/admin/profile-requests`;
  try {
    await sendPortalReviewAlert({
      subject: `Ashley Bands new guardian needs review: ${name}`,
      summary,
      reviewUrl,
      details: [
        `Submitted by: ${session.email}`,
        `Student: ${studentName}`,
        `Guardian: ${name}`,
        relationship ? `Relationship: ${relationship}` : "",
        phone ? `Phone: ${phone}` : "",
        email ? `Email: ${email}` : ""
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
