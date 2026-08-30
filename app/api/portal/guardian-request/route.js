import { PrivateResponse as NextResponse, privateServerError } from "@/lib/privateResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { readPortalSession } from "@/lib/portalTokens";
import { logAuditRequired } from "@/lib/auditLog";

export const runtime = "nodejs";

function normalizePhone(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

async function verifiedGuardianAccess(personId, studentId) {
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("id,assurance_level,portal_students(display_name),portal_people!inner(person_type)")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .in("assurance_level", ["medium", "high"])
    .eq("portal_people.person_type", "guardian")
    .maybeSingle();
  return data || null;
}

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

  const link = await verifiedGuardianAccess(session.personId, studentId);
  if (!link) return NextResponse.json({ error: "A verified guardian must make this change." }, { status: 403 });

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
  if (personId) {
    const { data: resolvedPerson } = await supabaseAdmin
      .from("portal_people")
      .select("person_type")
      .eq("id", personId)
      .maybeSingle();
    if (resolvedPerson?.person_type === "student") {
      return NextResponse.json({ error: "Use an adult guardian contact for this connection." }, { status: 409 });
    }
  }

  try {
    await logAuditRequired({
      actor: { type: "parent", id: session.personId, name: session.email },
      action: "add_guardian_requested",
      table: "portal_student_people",
      recordId: studentId,
      route: "/api/portal/guardian-request",
      changes: { studentId, relationship, phone: Boolean(phone), email: Boolean(email) },
    });
  } catch (error) {
    return privateServerError("guardian-request-audit", error, "Could not add this guardian.");
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
    .select("id,assurance_level")
    .eq("student_id", studentId)
    .eq("person_id", personId)
    .maybeSingle();
  if (existingLink) {
    await supabaseAdmin
      .from("portal_student_people")
      .update({
        relationship_status: "trusted",
        role: relationship || null,
        assurance_level: existingLink.assurance_level === "high" ? "high" : "medium",
        trust_source: "trusted_guardian_add",
        assured_at: nowIso,
        assured_by: session.personId,
        source: "portal_self_add",
        updated_at: nowIso,
      })
      .eq("id", existingLink.id);
  } else {
    const { error: linkError } = await supabaseAdmin.from("portal_student_people").insert({
      student_id: studentId, person_id: personId,
      relationship_status: "trusted", role: relationship || null,
      primary_contact: false, source: "portal_self_add",
      assurance_level: "medium", trust_source: "trusted_guardian_add",
      assured_at: nowIso, assured_by: session.personId,
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

export async function PATCH(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const guardianId = String(body.guardianId || "").trim();
  const name = String(body.name || "").trim().slice(0, 200);
  const relationship = String(body.relationship || "").trim().slice(0, 100);
  const phone = String(body.phone || "").trim().slice(0, 50);
  const email = String(body.email || "").trim().slice(0, 200);

  if (!studentId || !guardianId) return NextResponse.json({ error: "Guardian record not found." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Enter the guardian's name." }, { status: 400 });
  if (!phone && !email) return NextResponse.json({ error: "Enter a phone or email for the guardian." }, { status: 400 });
  const access = await verifiedGuardianAccess(session.personId, studentId);
  if (!access) return NextResponse.json({ error: "A verified guardian must make this change." }, { status: 403 });

  const { data: guardianLink } = await supabaseAdmin
    .from("portal_student_people")
    .select("id,role,portal_people(person_type)")
    .eq("student_id", studentId)
    .eq("person_id", guardianId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  const linkedPerson = Array.isArray(guardianLink?.portal_people) ? guardianLink.portal_people[0] : guardianLink?.portal_people;
  if (!guardianLink || linkedPerson?.person_type === "student") {
    return NextResponse.json({ error: "Guardian record not found." }, { status: 404 });
  }

  const { data: person } = await supabaseAdmin
    .from("portal_people")
    .select("display_name")
    .eq("id", guardianId)
    .maybeSingle();
  const { data: contacts } = await supabaseAdmin
    .from("portal_contact_methods")
    .select("id, contact_type, value_display")
    .eq("person_id", guardianId)
    .in("contact_type", ["email", "phone"])
    .order("created_at", { ascending: true });

  const oldValue = {
    name: person?.display_name || "",
    relationship: guardianLink.role || "",
    phone: contacts?.find((row) => row.contact_type === "phone")?.value_display || "",
    email: contacts?.find((row) => row.contact_type === "email")?.value_display || ""
  };
  const now = new Date().toISOString();
  const nameParts = name.split(/\s+/);

  try {
    await logAuditRequired({
      actor: { type: "parent", id: session.personId, name: session.email },
      action: "update_guardian_requested",
      table: "portal_people",
      recordId: guardianId,
      route: "/api/portal/guardian-request",
      changes: { old: oldValue, new: { name, relationship, phone, email }, studentId },
    });
  } catch (error) {
    return privateServerError("guardian-request-audit", error, "Could not update this guardian.");
  }

  const { error: personError } = await supabaseAdmin
    .from("portal_people")
    .update({
      display_name: name,
      first_name: nameParts[0] || name,
      last_name: nameParts.slice(1).join(" ") || null,
      updated_at: now
    })
    .eq("id", guardianId);
  if (personError) return NextResponse.json({ error: "Could not update this guardian." }, { status: 500 });

  const { error: linkError } = await supabaseAdmin
    .from("portal_student_people")
    .update({ role: relationship || null, updated_at: now })
    .eq("id", guardianLink.id);
  if (linkError) return NextResponse.json({ error: "Could not update this guardian." }, { status: 500 });

  for (const [type, value] of [["phone", phone], ["email", email]]) {
    const normalized = type === "phone" ? normalizePhone(value) : value.toLowerCase();
    const existing = contacts?.find((row) => row.contact_type === type);
    if (!value && existing) {
      const { error } = await supabaseAdmin
        .from("portal_contact_methods")
        .update({
          verification_status: "superseded",
          verification_source: "portal_family_edit",
          source: "portal_family_edit",
          updated_at: now
        })
        .eq("id", existing.id)
        .eq("person_id", guardianId);
      if (error) return NextResponse.json({ error: `Could not remove guardian ${type}.` }, { status: 500 });
    } else if (existing) {
      const { error } = await supabaseAdmin
        .from("portal_contact_methods")
        .update({
          value_display: value,
          value_normalized: normalized,
          verification_status: "unverified",
          verification_source: "portal_family_edit",
          verified_at: null,
          verified_by: null,
          source: "portal_family_edit",
          updated_at: now
        })
        .eq("id", existing.id)
        .eq("person_id", guardianId);
      if (error) return NextResponse.json({ error: `Could not update guardian ${type}.` }, { status: 500 });
    } else if (value) {
      const { error } = await supabaseAdmin.from("portal_contact_methods").insert({
        person_id: guardianId,
        contact_type: type,
        value_display: value,
        value_normalized: normalized,
        verification_status: "unverified",
        verification_source: "portal_family_edit",
        source: "portal_family_edit"
      });
      if (error) return NextResponse.json({ error: `Could not add guardian ${type}.` }, { status: 500 });
    }
  }

  const newValue = { name, relationship, phone, email };
  const summary = `${session.email} updated a guardian for ${access.portal_students?.display_name || "a student"}: ${name}`;
  const { data: updateRequest } = await supabaseAdmin
    .from("portal_update_requests")
    .insert({
      submitted_by_person_id: session.personId,
      student_id: studentId,
      target_table: "portal_people",
      target_id: guardianId,
      field_name: "edit_guardian",
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      sensitivity: "relationship",
      status: "approved",
      reviewed_by: "auto-approve (login-authorized) 2026-06-23",
      reviewed_at: now,
      review_notes: "Auto-applied: a trusted guardian updated a linked family contact."
    })
    .select("id")
    .single();

  const { data: reviewItem } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "contact_change",
      status: "approved",
      student_id: studentId,
      person_id: session.personId,
      update_request_id: updateRequest?.id || null,
      summary,
      details: { field: "edit_guardian", guardian_id: guardianId, old_value: oldValue, new_value: newValue, auto_approved: true }
    })
    .select("id")
    .single();

  if (updateRequest?.id && reviewItem?.id) {
    await supabaseAdmin.from("portal_update_requests").update({ review_item_id: reviewItem.id }).eq("id", updateRequest.id);
  }

  return NextResponse.json({ ok: true, updated: true });
}

export async function DELETE(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const guardianId = String(body.guardianId || "").trim();
  if (!studentId || !guardianId) {
    return NextResponse.json({ error: "Guardian record not found." }, { status: 400 });
  }

  const access = await verifiedGuardianAccess(session.personId, studentId);
  if (!access) return NextResponse.json({ error: "A verified guardian must make this change." }, { status: 403 });

  const { data: guardianLink, error: guardianError } = await supabaseAdmin
    .from("portal_student_people")
    .select("id, role, primary_contact, portal_people(id, display_name, person_type)")
    .eq("student_id", studentId)
    .eq("person_id", guardianId)
    .eq("relationship_status", "trusted")
    .maybeSingle();

  const guardian = Array.isArray(guardianLink?.portal_people)
    ? guardianLink.portal_people[0]
    : guardianLink?.portal_people;
  if (guardianError || !guardianLink || guardian?.person_type === "student") {
    return NextResponse.json({ error: "Guardian record not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const guardianName = guardian?.display_name || "Guardian";
  const studentName = access.portal_students?.display_name || "this student";
  const oldValue = {
    guardianId,
    name: guardianName,
    relationship: guardianLink.role || "",
    primary: Boolean(guardianLink.primary_contact),
    relationshipStatus: "trusted"
  };
  const newValue = { relationshipStatus: "superseded" };

  try {
    await logAuditRequired({
      actor: { type: "parent", id: session.personId, name: session.email },
      action: "remove_guardian_requested",
      table: "portal_student_people",
      recordId: guardianLink.id,
      route: "/api/portal/guardian-request",
      changes: { old: oldValue, new: newValue, studentId },
    });
  } catch (error) {
    return privateServerError("guardian-request-audit", error, "Could not remove this guardian.");
  }

  // Preserve the person and their links to any other students. Removing a
  // guardian here revokes only this trusted student relationship and keeps the
  // change reversible and auditable.
  const { error: removeError } = await supabaseAdmin
    .from("portal_student_people")
    .update({ relationship_status: "superseded", primary_contact: false, updated_at: now })
    .eq("id", guardianLink.id)
    .eq("relationship_status", "trusted");
  if (removeError) {
    return NextResponse.json({ error: "Could not remove this guardian." }, { status: 500 });
  }

  const summary = `${session.email} removed ${guardianName} as a guardian for ${studentName}`;
  const { data: updateRequest } = await supabaseAdmin
    .from("portal_update_requests")
    .insert({
      submitted_by_person_id: session.personId,
      student_id: studentId,
      target_table: "portal_student_people",
      target_id: guardianLink.id,
      field_name: "remove_guardian",
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      sensitivity: "relationship",
      status: "approved",
      reviewed_by: "auto-approve (login-authorized) 2026-06-23",
      reviewed_at: now,
      review_notes: "Auto-applied: a trusted family member removed a guardian relationship."
    })
    .select("id")
    .single();

  const { data: reviewItem } = await supabaseAdmin
    .from("portal_review_queue")
    .insert({
      item_type: "contact_change",
      status: "approved",
      student_id: studentId,
      person_id: session.personId,
      update_request_id: updateRequest?.id || null,
      summary,
      details: {
        field: "remove_guardian",
        guardian_id: guardianId,
        guardian_name: guardianName,
        old_value: oldValue,
        new_value: newValue,
        auto_approved: true
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

  return NextResponse.json({ ok: true, removed: true });
}
