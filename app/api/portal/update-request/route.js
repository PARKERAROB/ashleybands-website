import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

// Fields a signed-in person may edit about themselves or their own students.
// Each write hits the Supabase mirror immediately (so the family sees it) and is
// AUTO-APPROVED + logged (Rob 2026-06-23): the parent's login already authorizes the
// edit, so there is no review gate. The portal_review_queue row is the audit log.
// See docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md
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
  },
  student_school_email: {
    label: "Student email",
    targetTable: "portal_students",
    sensitivity: "contact"
  },
  student_notes: {
    label: "Student notes",
    targetTable: "portal_students",
    sensitivity: "medical",
    allowEmpty: true
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
  if (!newValue && !config.allowEmpty) {
    return NextResponse.json({ error: "Enter the updated information before submitting." }, { status: 400 });
  }
  if (field === "student_school_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)) {
    return NextResponse.json({ error: "Enter a valid student email address." }, { status: 400 });
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
      // AUTO-APPROVE (Rob 2026-06-23): the parent is login-authorized; no manual gate. Logged for audit.
      status: "approved",
      reviewed_by: "auto-approve (login-authorized) 2026-06-23",
      reviewed_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (updateError) return NextResponse.json({ error: "Could not stage update." }, { status: 500 });

  const { data: reviewItem, error: reviewError } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: config.sensitivity === "contact"
        ? "contact_change"
        : config.sensitivity === "medical"
          ? "sensitive_submission"
          : "profile_conflict",
      status: "approved",
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

  await logAudit({
    actor: { type: "parent", id: session.personId, name: session.email },
    action: "update",
    table: config.targetTable,
    recordId: targetId || studentId || session.personId,
    route: "/api/portal/update-request",
    changes: { [field]: { old: oldValue, new: newValue } }
  });

  // No review alert: parent edits auto-approve (login-authorized). The review_queue row above is the
  // audit log. See docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md
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
      .update({
        preferred_first: newValue,
        display_name: await studentDisplayName(studentId, newValue),
        updated_at: now
      })
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
    return;
  }

  if (field === "student_school_email") {
    const { error } = await supabaseAdmin
      .from("portal_students")
      .update({ school_email: newValue.toLowerCase(), updated_at: now })
      .eq("id", studentId);
    if (error) throw new Error(error.message);
    return;
  }

  if (field === "student_notes") {
    const { error } = await supabaseAdmin
      .from("portal_students")
      .update({ notes: newValue || null, updated_at: now })
      .eq("id", studentId);
    if (error) throw new Error(error.message);
  }
}

async function studentDisplayName(studentId, preferredFirst) {
  const { data, error } = await supabaseAdmin
    .from("portal_students")
    .select("legal_first, legal_last")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return [preferredFirst || data?.legal_first, data?.legal_last].filter(Boolean).join(" ").trim();
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
  if (field === "student_school_email") {
    const { data } = await supabaseAdmin
      .from("portal_students")
      .select("school_email")
      .eq("id", studentId)
      .maybeSingle();
    return data?.school_email || "";
  }
  if (field === "student_notes") {
    const { data } = await supabaseAdmin
      .from("portal_students")
      .select("notes")
      .eq("id", studentId)
      .maybeSingle();
    return data?.notes || "";
  }
  return "";
}
