import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

function text(v) {
  return String(v || "").trim();
}
function normEmail(v) {
  return text(v).toLowerCase();
}
function normPhone(v) {
  return text(v).replace(/\D/g, "");
}

// POST -> add a guardian to a student (person + contacts + trusted link).
// body: { studentId, name, email?, phone?, role?, primary? }
// Reuses an existing person if the email already exists as a contact.
export async function POST(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = text(body.studentId);
  const name = text(body.name);
  const email = normEmail(body.email);
  const phone = text(body.phone);
  if (!studentId || !name) {
    return NextResponse.json({ error: "Student and guardian name are required." }, { status: 400 });
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "Provide at least an email or phone." }, { status: 400 });
  }

  const { data: student } = await supabaseAdmin
    .from("portal_students")
    .select("id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  // Reuse an existing person if this email is already on file.
  let personId = null;
  if (email) {
    const { data: existingContact } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("person_id")
      .eq("contact_type", "email")
      .eq("value_normalized", email)
      .maybeSingle();
    if (existingContact) personId = existingContact.person_id;
  }

  if (!personId) {
    const sourceKey = `guardian:manual:${email || normPhone(phone)}:${Date.now().toString(36)}`;
    const { data: person, error: personError } = await supabaseAdmin
      .from("portal_people")
      .insert({
        source_person_key: sourceKey,
        person_type: "guardian",
        display_name: name,
        first_name: name.split(/\s+/)[0] || name,
        last_name: name.split(/\s+/).slice(1).join(" ") || null,
        source: "manual"
      })
      .select("id")
      .single();
    if (personError) return NextResponse.json({ error: personError.message }, { status: 500 });
    personId = person.id;

    if (email) {
      await supabaseAdmin.from("portal_contact_methods").insert({
        person_id: personId,
        contact_type: "email",
        value_display: text(body.email),
        value_normalized: email,
        verification_status: "unverified",
        source: "manual"
      });
    }
    if (phone) {
      await supabaseAdmin.from("portal_contact_methods").insert({
        person_id: personId,
        contact_type: "phone",
        value_display: phone,
        value_normalized: normPhone(phone),
        verification_status: "unverified",
        source: "manual"
      });
    }
  }

  // Trusted link (idempotent: unique on student_id + person_id).
  const { error: linkError } = await supabaseAdmin
    .from("portal_student_people")
    .upsert(
      {
        student_id: studentId,
        person_id: personId,
        role: text(body.role) || "Parent",
        relationship_status: "trusted",
        primary_contact: Boolean(body.primary),
        source: "manual"
      },
      { onConflict: "student_id,person_id" }
    );
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "insert",
    table: "portal_student_people",
    recordId: `${studentId}:${personId}`,
    route: "/api/admin/students/guardians",
    changes: {
      student_id: { old: null, new: studentId },
      person_id: { old: null, new: personId },
      name: { old: null, new: name },
      role: { old: null, new: text(body.role) || "Parent" }
    }
  });

  return NextResponse.json({ ok: true, personId });
}
