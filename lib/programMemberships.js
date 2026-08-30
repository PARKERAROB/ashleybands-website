import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CLOSED_CONTACT_STATUSES = new Set(["hard_bounce", "replaced", "superseded"]);

function text(value) {
  return String(value || "").trim();
}

function chunks(values, size = 40) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function latest(values) {
  return values.filter(Boolean).map(String).sort().at(-1) || null;
}

function legalName(student) {
  return [student.legal_first, student.legal_last].filter(Boolean).join(" ").trim() || student.display_name;
}

async function rows(query, message) {
  const { data, error } = await query;
  if (error) throw new Error(`${message}: ${error.message}`);
  return data || [];
}

export async function loadProgramMemberships() {
  const [studentRows, groupRows, membershipRows, sectionRows, enrollmentRows, expectationRows] = await Promise.all([
    rows(supabaseAdmin.from("portal_students")
      .select("id,display_name,legal_first,legal_last,grade_fall26,band_class_2026,instrument_2026,mb_role_2026,updated_at")
      .eq("status", "active")
      .order("legal_last", { ascending: true })
      .order("legal_first", { ascending: true })
      .limit(500), "Current students could not be loaded"),
    rows(supabaseAdmin.from("program_groups")
      .select("id,code,name,group_type,school_year,status,owner,source,source_reference,updated_at")
      .eq("status", "active")
      .is("ends_on", null)
      .order("name", { ascending: true }), "Program groups could not be loaded"),
    rows(supabaseAdmin.from("program_memberships")
      .select("id,group_id,student_id,membership_role,source,source_reference,updated_at")
      .is("ends_on", null), "Program memberships could not be loaded"),
    rows(supabaseAdmin.from("school_class_sections")
      .select("id,code,name,section_code,school_year,term,status,source,source_reference,last_synced_at,updated_at")
      .eq("status", "active")
      .is("ends_on", null)
      .order("name", { ascending: true }), "School class sections could not be loaded"),
    rows(supabaseAdmin.from("student_class_enrollments")
      .select("id,section_id,student_id,source,source_reference,last_synced_at,updated_at")
      .is("ends_on", null), "School class enrollments could not be loaded"),
    rows(supabaseAdmin.from("group_class_expectations")
      .select("group_id,section_id,relationship_type,source"), "Group and class connections could not be loaded"),
  ]);

  const activeStudentIds = new Set(studentRows.map((student) => student.id));
  const activeGroupIds = new Set(groupRows.map((group) => group.id));
  const activeSectionIds = new Set(sectionRows.map((section) => section.id));
  const memberships = membershipRows.filter((membership) => activeStudentIds.has(membership.student_id) && activeGroupIds.has(membership.group_id));
  const enrollments = enrollmentRows.filter((enrollment) => activeStudentIds.has(enrollment.student_id) && activeSectionIds.has(enrollment.section_id));

  const membershipIdsByStudent = {};
  const memberIdsByGroup = {};
  const membershipSourcesByGroup = {};
  for (const membership of memberships) {
    (membershipIdsByStudent[membership.student_id] ||= []).push(membership.group_id);
    (memberIdsByGroup[membership.group_id] ||= []).push(membership.student_id);
    (membershipSourcesByGroup[membership.group_id] ||= []).push(membership.source);
  }
  const sectionIdsByStudent = {};
  const studentIdsBySection = {};
  for (const enrollment of enrollments) {
    (sectionIdsByStudent[enrollment.student_id] ||= []).push(enrollment.section_id);
    (studentIdsBySection[enrollment.section_id] ||= []).push(enrollment.student_id);
  }
  const sectionIdsByGroup = {};
  const groupIdsBySection = {};
  for (const expectation of expectationRows) {
    if (!activeGroupIds.has(expectation.group_id) || !activeSectionIds.has(expectation.section_id)) continue;
    (sectionIdsByGroup[expectation.group_id] ||= []).push(expectation.section_id);
    (groupIdsBySection[expectation.section_id] ||= []).push(expectation.group_id);
  }

  const students = studentRows.map((student) => ({
    id: student.id,
    displayName: student.display_name,
    legalName: legalName(student),
    grade: text(student.grade_fall26) || "Not listed",
    bandClassStatus: text(student.band_class_2026) || "Unknown",
    instrument: text(student.instrument_2026) || text(student.mb_role_2026) || "Not listed",
    groupIds: membershipIdsByStudent[student.id] || [],
    sectionIds: sectionIdsByStudent[student.id] || [],
  }));
  const groups = groupRows.map((group) => ({
    id: group.id,
    code: group.code,
    name: group.name,
    type: group.group_type,
    schoolYear: group.school_year,
    owner: group.owner,
    source: group.source,
    sourceReference: group.source_reference,
    memberIds: memberIdsByGroup[group.id] || [],
    membershipSources: [...new Set(membershipSourcesByGroup[group.id] || [])],
    expectedSectionIds: sectionIdsByGroup[group.id] || [],
  }));
  const sections = sectionRows.map((section) => ({
    id: section.id,
    code: section.code,
    name: section.name,
    sectionCode: text(section.section_code),
    schoolYear: section.school_year,
    term: text(section.term),
    source: section.source,
    sourceReference: section.source_reference,
    lastSyncedAt: section.last_synced_at,
    studentIds: studentIdsBySection[section.id] || [],
    expectedGroupIds: groupIdsBySection[section.id] || [],
  }));

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  const attention = [];
  for (const student of students) {
    if (!student.groupIds.length) {
      attention.push({ studentId: student.id, type: "No program membership", detail: "No current AshleyBands group is connected." });
    }
    for (const sectionId of student.sectionIds) {
      const section = sectionsById.get(sectionId);
      const expected = section?.expectedGroupIds || [];
      if (expected.length && !expected.some((groupId) => student.groupIds.includes(groupId))) {
        attention.push({
          studentId: student.id,
          type: "Class connection needs review",
          detail: `${section.name} does not match the current program membership.`,
        });
      }
    }
    for (const groupId of student.groupIds) {
      const group = groupsById.get(groupId);
      const expected = group?.expectedSectionIds || [];
      if (expected.length && !expected.some((sectionId) => student.sectionIds.includes(sectionId))) {
        attention.push({
          studentId: student.id,
          type: student.sectionIds.length ? "Program and class records differ" : "Expected class enrollment missing",
          detail: student.sectionIds.length
            ? `Program membership: ${group.name} · class import: a different section.`
            : `Program membership: ${group.name} · class import: no section connected.`,
        });
      }
    }
  }

  return {
    students,
    groups,
    sections,
    attention,
    counts: { students: students.length, groups: groups.length, sections: sections.length, attention: attention.length },
    updatedAt: latest([
      ...studentRows.map((row) => row.updated_at),
      ...groupRows.map((row) => row.updated_at),
      ...memberships.map((row) => row.updated_at),
      ...sectionRows.map((row) => row.updated_at),
      ...enrollments.map((row) => row.updated_at),
    ]),
  };
}

export async function loadMembershipContactEmails(studentIds, audience = "both") {
  const requested = [...new Set((studentIds || []).map(String).filter(Boolean))].slice(0, 250);
  if (!requested.length) return { emails: [], studentCount: 0 };

  const studentResults = await Promise.all(chunks(requested).map((studentChunk) => supabaseAdmin
    .from("portal_students")
    .select("id,school_email")
    .in("id", studentChunk)
    .eq("status", "active")));
  const studentError = studentResults.find((result) => result.error)?.error;
  if (studentError) throw new Error(studentError.message);
  const students = studentResults.flatMap((result) => result.data || []);
  const activeIds = students.map((student) => student.id);
  const values = [];
  if (audience !== "guardians") values.push(...students.map((student) => text(student.school_email)).filter(Boolean));

  if (audience !== "students" && activeIds.length) {
    const linkResults = await Promise.all(chunks(activeIds).map((studentChunk) => supabaseAdmin
      .from("portal_student_people")
      .select("person_id,assurance_level,portal_people(person_type)")
      .in("student_id", studentChunk)
      .eq("relationship_status", "trusted")
      .in("assurance_level", ["medium", "high"])));
    const linkError = linkResults.find((result) => result.error)?.error;
    if (linkError) throw new Error(linkError.message);
    const personIds = [...new Set(linkResults.flatMap((result) => result.data || [])
      .filter((link) => link.portal_people?.person_type === "guardian")
      .map((link) => link.person_id))];
    if (personIds.length) {
      const contactResults = await Promise.all(chunks(personIds).map((personChunk) => supabaseAdmin
        .from("portal_contact_methods")
        .select("value_display,verification_status")
        .in("person_id", personChunk)
        .eq("contact_type", "email")));
      const contactError = contactResults.find((result) => result.error)?.error;
      if (contactError) throw new Error(contactError.message);
      values.push(...contactResults.flatMap((result) => result.data || [])
        .filter((contact) => !CLOSED_CONTACT_STATUSES.has(contact.verification_status))
        .map((contact) => text(contact.value_display))
        .filter(Boolean));
    }
  }

  return { emails: [...new Set(values)], studentCount: activeIds.length, subjectStudentIds: activeIds };
}
