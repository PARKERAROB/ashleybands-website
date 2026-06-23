import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

// Fields a signed-in person may edit about themselves or their own students.
// Each write hits the Supabase mirror immediately (so the family sees it) AND
// queues a review request for Rob to push into the canonical CSV.
// POLICY (Rob 2026-06-23): parent changes should AUTO-APPROVE — the login already
// authorizes them; no review gate. Land approved + logged, not needs_review; the
// queue is an audit log. See docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md
// (TODO: this flow still writes status:"needs_review" — change to auto-approve.)
const ALLOWED_FIELDS = {
  person_display_name: {
    label: "Your name",
    targetTable: "portal_people",
    sensitivity: "normal"
  },
  person_phone: {
    label: "Your phone",
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

  // Apply to the mirror right away so the change shows on the site.
  let mirrorApplied = false;
  try {
    await applyMirrorWrite({ field, session, studentId, targetId, newValue });
    mirrorApplied = true;
  } catch (error) {
    // If the live write fails, still queue it for Rob; just don't claim it's applied.
    mirrorApplied = false;
  }

  const summary = `${session.email} updated a profile field: ${config.label}`;

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
        submitted_by_email: session.email,
        mirror_applied: mirrorApplied
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
        `New: ${newValue}`,
        mirrorApplied ? "Already showing on the site; push to CSV when ready." : "Not yet applied on site - apply manually."
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

  return NextResponse.json({ ok: true, mirrorApplied, value: newValue });
}

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

async function applyMirrorWrite({ field, session, studentId, targetId, newValue }) {
  const now = new Date().toISOString();

  if (field === "person_display_name") {
    const { error } = await supabaseAdmin
      .from("portal_people")
      .update({ display_name: newValue, updated_at: now })
      .eq("id", session.personId);
    if (error) throw new Error(error.message);
    return;
  }

  if (field === "person_phone") {
    const normalized = normalizePhone(newValue);
    if (targetId) {
      const { error } = await supabaseAdmin
        .from("portal_contact_methods")
        .update({ value_display: newValue, value_normalized: normalized, updated_at: now })
        .eq("id", targetId)
        .eq("person_id", session.personId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("portal_contact_methods").insert({
        person_id: session.personId,
        contact_type: "phone",
        value_display: newValue,
        value_normalized: normalized,
        verification_status: "unverified",
        verification_source: "portal_self_edit"
      });
      if (error) throw new Error(error.message);
    }
    return;
  }

  if (field === "student_preferred_first") {
    const { error } = await supabaseAdmin
      .from("portal_students")
      .update({ preferred_first: newValue, updated_at: now })
      .eq("id", studentId);
    if (error) throw new Error(error.message);
    return;
  }

  if (field === "student_cell_phone") {
    const { error } = await supabaseAdmin
      .from("portal_students")
      .update({ cell_phone: newValue, updated_at: now })
      .eq("id", studentId);
    if (error) throw new Error(error.message);
  }
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
  if (field === "person_phone") {
    const { data } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("id")
      .eq("person_id", session.personId)
      .eq("contact_type", "phone")
      .limit(1)
      .maybeSingle();
    return data?.id || null;
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
  if (field === "person_phone") {
    if (!targetId) return "";
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
