import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

function splitContacts(rows) {
  const emails = [];
  const phones = [];
  for (const row of rows || []) {
    const item = { id: row.id, value: row.value_display, status: row.verification_status };
    if (row.contact_type === "phone") phones.push(item);
    else if (row.contact_type === "email") emails.push(item);
  }
  return { emails, phones };
}

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const [{ data: person, error: personError }, { data: ownContacts }, { data: links, error: linksError }] =
    await Promise.all([
      supabaseAdmin
        .from("portal_people")
        .select("id, display_name, person_type")
        .eq("id", session.personId)
        .maybeSingle(),
      supabaseAdmin
        .from("portal_contact_methods")
        .select("id, contact_type, value_display, verification_status")
        .eq("person_id", session.personId),
      supabaseAdmin
        .from("portal_student_people")
        .select(
          "student_id, relationship_status, role, primary_contact, portal_students(id, display_name, preferred_first, grade_fall26, status, school_email, cell_phone, notes, band_class_2026, band_period_2026, ensemble_2026, instrument_2026, marching_2026, mb_role_2026, marching_role_category_2026, marching_assignment_2026)"
        )
        .eq("person_id", session.personId)
        .eq("relationship_status", "trusted")
    ]);

  if (personError || linksError) {
    return NextResponse.json({ error: "Could not load portal profile." }, { status: 500 });
  }

  const students = (links || [])
    .map((link) => ({
      id: link.portal_students?.id,
      displayName: link.portal_students?.display_name,
      preferredFirst: link.portal_students?.preferred_first,
      grade: link.portal_students?.grade_fall26,
      status: link.portal_students?.status,
      schoolEmail: link.portal_students?.school_email,
      cellPhone: link.portal_students?.cell_phone,
      note: link.portal_students?.notes || "",
      bandClass2026: link.portal_students?.band_class_2026 || "",
      bandPeriod2026: link.portal_students?.band_period_2026 || "",
      ensemble2026: link.portal_students?.ensemble_2026 || "",
      instrument2026: link.portal_students?.instrument_2026 || "",
      marching2026: link.portal_students?.marching_2026 || "",
      marchingRole2026: link.portal_students?.mb_role_2026 || "",
      marchingRoleCategory2026: link.portal_students?.marching_role_category_2026 || "",
      marchingAssignment2026: link.portal_students?.marching_assignment_2026 || "",
      participationRequest: null,
      guardians: []
    }))
    .filter((student) => student.id);

  // Attach the other adult guardians linked to each student.
  const studentIds = students.map((s) => s.id);
  if (studentIds.length) {
    const { data: pendingParticipation } = await supabaseAdmin
      .from("portal_update_requests")
      .select("id, student_id, new_value, submitted_at")
      .in("student_id", studentIds)
      .eq("submitted_by_person_id", session.personId)
      .eq("field_name", "participation_bundle")
      .eq("status", "needs_review")
      .order("submitted_at", { ascending: false });

    for (const requestRow of pendingParticipation || []) {
      const student = students.find((item) => item.id === requestRow.student_id);
      if (!student || student.participationRequest) continue;
      try {
        student.participationRequest = {
          id: requestRow.id,
          requested: JSON.parse(requestRow.new_value || "{}"),
          submittedAt: requestRow.submitted_at
        };
      } catch {
        student.participationRequest = { id: requestRow.id, requested: {}, submittedAt: requestRow.submitted_at };
      }
    }

    const { data: guardianLinks } = await supabaseAdmin
      .from("portal_student_people")
      .select("student_id, role, primary_contact, portal_people(id, display_name, person_type)")
      .in("student_id", studentIds)
      .eq("relationship_status", "trusted");

    const guardianPeople = (guardianLinks || []).filter(
      (link) => link.portal_people && link.portal_people.person_type !== "student"
    );
    const guardianIds = [...new Set(guardianPeople.map((link) => link.portal_people.id))];

    let contactsByPerson = {};
    if (guardianIds.length) {
      const { data: guardianContacts } = await supabaseAdmin
        .from("portal_contact_methods")
        .select("person_id, contact_type, value_display, verification_status")
        .in("person_id", guardianIds)
        .not("verification_status", "in", "(superseded,replaced,hard_bounce)");
      contactsByPerson = (guardianContacts || []).reduce((acc, row) => {
        (acc[row.person_id] = acc[row.person_id] || []).push(row);
        return acc;
      }, {});
    }

    const byStudent = students.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {});

    for (const link of guardianPeople) {
      const student = byStudent[link.student_id];
      if (!student) continue;
      const personId = link.portal_people.id;
      const contacts = contactsByPerson[personId] || [];
      student.guardians.push({
        id: personId,
        name: link.portal_people.display_name,
        role: link.role || "",
        primary: Boolean(link.primary_contact),
        isSelf: personId === session.personId,
        phones: contacts.filter((c) => c.contact_type === "phone").map((c) => c.value_display),
        emails: contacts.filter((c) => c.contact_type === "email").map((c) => c.value_display)
      });
    }
  }

  return NextResponse.json({
    person,
    email: session.email,
    contacts: splitContacts(ownContacts),
    students
  });
}
