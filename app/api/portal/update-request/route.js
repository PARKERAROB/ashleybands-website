import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

const ALLOWED_FIELDS = {
  person_display_name: {
    label: "Name",
    targetTable: "portal_people",
    sensitivity: "normal"
  },
  guardian_phone: {
    label: "Phone",
    targetTable: "portal_contact_methods",
    sensitivity: "contact"
  },
  student_preferred_first: {
    label: "Student preferred name",
    targetTable: "portal_students",
    sensitivity: "normal"
  },
  student_cell_phone: {
    label: "Student cell phone",
    targetTable: "portal_students",
    sensitivity: "contact"
  },
  student_note: {
    label: "Student note",
    targetTable: "portal_students",
    sensitivity: "relationship"
  }
};

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const field = String(body.field || "");
  const config = ALLOWED_FIELDS[field];
  const newValue = String(body.value || "").trim().slice(0, 1000);
  const studentId = String(body.studentId || "").trim() || null;

  if (!config) {
    return NextResponse.json({ error: "That field cannot be updated here." }, { status: 400 });
  }
  if (!newValue) {
    return NextResponse.json({ error: "Enter the updated information before submitting." }, { status: 400 });
  }

  if (field.startsWith("student_")) {
    const trusted = await hasTrustedStudentAccess(session.personId, studentId);
    if (!trusted) return NextResponse.json({ error: "Student access not found." }, { status: 403 });
  }

  const targetId = await resolveTargetId({ field, session, studentId });
  const oldValue = await resolveOldValue({ field, targetId, session, studentId });
  const summary = `${session.email} submitted a profile update: ${config.label}`;

  const { data: updateRequest, error: updateError } = await supabaseAdmin
    .from("portal_update_requests")
    .insert({
      submitted_by_person_id: session.personId,
      student_id: studentId,
      target_table: config.targetTable,
      target_id: targetId,
      field_name: field,
      old_value: oldValue,
      new_value: newValue,
      sensitivity: config.sensitivity,
      status: "needs_review"
    })
    .select("id")
    .single();

  if (updateError) return NextResponse.json({ error: "Could not stage update." }, { status: 500 });

  const { data: reviewItem, error: reviewError } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: config.sensitivity === "contact" ? "contact_change" : "profile_conflict",
      status: "needs_review",
      student_id: studentId,
      person_id: session.personId,
      update_request_id: updateRequest.id,
      summary,
      details: {
        field,
        label: config.label,
        old_value: oldValue,
        new_value: newValue,
        submitted_by_email: session.email
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
      subject: `Ashley Bands profile update needs review: ${config.label}`,
      summary,
      reviewUrl,
      details: [
        `Submitted by: ${session.email}`,
        `Field: ${config.label}`,
        `Old: ${oldValue || "blank"}`,
        `New: ${newValue}`
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

async function hasTrustedStudentAccess(personId, studentId) {
  if (!studentId) return false;
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("id")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  return Boolean(data);
}

async function resolveTargetId({ field, session, studentId }) {
  if (field === "person_display_name") return session.personId;
  if (field.startsWith("student_")) return studentId;
  if (field === "guardian_phone") {
    const { data } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("id")
      .eq("person_id", session.personId)
      .eq("contact_type", "phone")
      .limit(1)
      .maybeSingle();
    return data?.id || session.personId;
  }
  return null;
}

async function resolveOldValue({ field, targetId, session, studentId }) {
  if (field === "person_display_name") {
    const { data } = await supabaseAdmin
      .from("portal_people")
      .select("display_name")
      .eq("id", session.personId)
      .maybeSingle();
    return data?.display_name || "";
  }
  if (field === "guardian_phone") {
    const { data } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("value_display")
      .eq("id", targetId)
      .maybeSingle();
    return data?.value_display || "";
  }
  if (field === "student_preferred_first") {
    const { data } = await supabaseAdmin
      .from("portal_students")
      .select("preferred_first")
      .eq("id", studentId)
      .maybeSingle();
    return data?.preferred_first || "";
  }
  if (field === "student_cell_phone") {
    const { data } = await supabaseAdmin
      .from("portal_students")
      .select("cell_phone")
      .eq("id", studentId)
      .maybeSingle();
    return data?.cell_phone || "";
  }
  return "";
}
