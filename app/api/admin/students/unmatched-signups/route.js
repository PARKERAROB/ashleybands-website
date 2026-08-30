import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import {
  loadUnmatchedSignups,
  MARCHING_BAND_2026_FEE_CENTS,
  MARCHING_BAND_2026_CATEGORY,
  MARCHING_BAND_2026_LABEL
} from "@/lib/marchingBandSignups";

export const runtime = "nodejs";

function text(v) {
  return String(v || "").trim();
}

// GET -> MB signups with no matching student record.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  try {
    const unmatched = await loadUnmatchedSignups();
    return NextResponse.json({ unmatched });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST { signupId } -> create student (+ guardian + $500 MB charge) from a signup.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, [
    STAFF_CAPABILITIES.STUDENTS_WRITE,
    STAFF_CAPABILITIES.BILLING_WRITE,
  ]);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));
  const signupId = text(body.signupId);
  if (!signupId) return NextResponse.json({ error: "Missing signupId" }, { status: 400 });

  let sg;
  try {
    const unmatched = await loadUnmatchedSignups();
    sg = unmatched.find((u) => u.signupId === signupId);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!sg) return NextResponse.json({ error: "Signup not found or already matched." }, { status: 404 });

  const { student, guardian } = sg;
  if (!student.firstName || !student.lastName) {
    return NextResponse.json({ error: "Signup is missing a student name." }, { status: 400 });
  }

  const email = student.email.toLowerCase();
  const sourceStudentId = email || `${student.firstName}${student.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "") + `-manual-${Date.now().toString(36)}`;

  // Create-or-get student.
  let studentId;
  const { data: existing } = await supabaseAdmin
    .from("portal_students")
    .select("id")
    .eq("source_student_id", sourceStudentId)
    .maybeSingle();
  if (existing) {
    studentId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("portal_students")
      .insert({
        source_student_id: sourceStudentId,
        legal_first: student.firstName,
        legal_last: student.lastName,
        display_name: `${student.firstName} ${student.lastName}`.trim(),
        grade_fall26: student.gradeFall || null,
        school_email: email || null,
        cell_phone: student.phone || null,
        status: "active",
        source: "manual",
        notes: `Created from MB signup by ${staff.display_name}`
      })
      .select("id")
      .single();
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    studentId = created.id;
  }

  // Link guardian (reuse existing person if the email is already on file).
  if (guardian.name && (guardian.email || guardian.phone)) {
    const gEmail = guardian.email.toLowerCase();
    let personId = null;
    if (gEmail) {
      const { data: c } = await supabaseAdmin
        .from("portal_contact_methods")
        .select("person_id")
        .eq("contact_type", "email")
        .eq("value_normalized", gEmail)
        .maybeSingle();
      if (c) personId = c.person_id;
    }
    if (!personId) {
      const { data: person } = await supabaseAdmin
        .from("portal_people")
        .insert({
          source_person_key: `guardian:manual:${gEmail || guardian.phone}:${Date.now().toString(36)}`,
          person_type: "guardian",
          display_name: guardian.name,
          first_name: guardian.name.split(/\s+/)[0] || guardian.name,
          last_name: guardian.name.split(/\s+/).slice(1).join(" ") || null,
          source: "manual"
        })
        .select("id")
        .single();
      personId = person?.id;
      if (personId && gEmail) {
        await supabaseAdmin.from("portal_contact_methods").insert({
          person_id: personId, contact_type: "email", value_display: guardian.email,
          value_normalized: gEmail, verification_status: "unverified", source: "manual"
        });
      }
      if (personId && guardian.phone) {
        await supabaseAdmin.from("portal_contact_methods").insert({
          person_id: personId, contact_type: "phone", value_display: guardian.phone,
          value_normalized: guardian.phone.replace(/\D/g, ""), verification_status: "unverified", source: "manual"
        });
      }
    }
    if (personId) {
      await supabaseAdmin.from("portal_student_people").upsert(
        { student_id: studentId, person_id: personId, role: "Parent", relationship_status: "trusted", primary_contact: true, source: "manual" },
        { onConflict: "student_id,person_id" }
      );
    }
  }

  // Ensure the $500 MB charge.
  const { data: charge } = await supabaseAdmin
    .from("fee_charges")
    .select("id")
    .eq("student_id", studentId)
    .eq("category", MARCHING_BAND_2026_CATEGORY)
    .eq("status", "active")
    .limit(1);
  if (!charge || !charge.length) {
    await supabaseAdmin.from("fee_charges").insert({
      student_id: studentId,
      category: MARCHING_BAND_2026_CATEGORY,
      label: MARCHING_BAND_2026_LABEL,
      amount_cents: MARCHING_BAND_2026_FEE_CENTS,
      source: "signup",
      created_by: staff.display_name
    });
  }

  return NextResponse.json({ ok: true, studentId, created: !existing });
}
