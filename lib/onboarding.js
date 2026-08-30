import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ONBOARDING_FORM_VERSION = "career-onboarding-v1";

function value(input) {
  return String(input || "").trim();
}

function relation(row, key) {
  const item = row?.[key];
  return Array.isArray(item) ? item[0] || null : item || null;
}

function activeContacts(rows, type, purpose) {
  return (rows || []).filter((contact) =>
    contact.contact_type === type
    && (!purpose || contact.contact_purpose === purpose)
    && !["hard_bounce", "replaced", "superseded"].includes(contact.verification_status)
  );
}

export async function loadOnboardingRecord(student) {
  const studentId = student.id;
  const [
    profileResult,
    enrollmentResult,
    musicResult,
    otherInstrumentResult,
    interestResult,
    backgroundResult,
    measurementResult,
    supportResult,
    progressResult,
    completionResult,
    relationshipResult,
  ] = await Promise.all([
    supabaseAdmin.from("portal_student_profiles").select("name_pronunciation,pronouns,updated_at").eq("student_id", studentId).maybeSingle(),
    supabaseAdmin.from("portal_student_enrollments").select("grade,school_year,source,source_reference,updated_at,portal_schools(code,name)").eq("student_id", studentId).is("ends_on", null).maybeSingle(),
    supabaseAdmin.from("portal_student_music_profiles").select("primary_instrument_none,years_playing,instrument_access,updated_at,portal_instrument_types(name)").eq("student_id", studentId).maybeSingle(),
    supabaseAdmin.from("portal_student_other_instruments").select("portal_instrument_types(name)").eq("student_id", studentId),
    supabaseAdmin.from("portal_student_interests").select("portal_interest_types(name)").eq("student_id", studentId),
    supabaseAdmin.from("portal_student_school_background").select("external_school_name,external_city,external_state,no_previous_music_program,updated_at,portal_schools(code,name)").eq("student_id", studentId).maybeSingle(),
    supabaseAdmin.from("portal_student_measurements").select("shirt_size,shirt_size_updated_at").eq("student_id", studentId).maybeSingle(),
    supabaseAdmin.from("portal_support_requests").select("id,areas,note,status,updated_at").eq("student_id", studentId).eq("source", "portal_onboarding").eq("status", "open").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("portal_onboarding_progress").select("last_completed_step,completion_status,updated_at").eq("student_id", studentId).eq("form_version", ONBOARDING_FORM_VERSION).maybeSingle(),
    supabaseAdmin.from("portal_onboarding_completions").select("first_submitted_at,last_confirmed_at,revision").eq("student_id", studentId).eq("form_version", ONBOARDING_FORM_VERSION).maybeSingle(),
    supabaseAdmin.from("portal_student_people").select("person_id,role,primary_contact,emergency_contact,relationship_status,created_at,portal_people(id,person_type,display_name)").eq("student_id", studentId).not("relationship_status", "in", "(rejected,superseded)"),
  ]);

  const results = [profileResult, enrollmentResult, musicResult, otherInstrumentResult, interestResult, backgroundResult, measurementResult, supportResult, progressResult, completionResult, relationshipResult];
  const failure = results.find((result) => result.error);
  if (failure?.error) throw failure.error;

  const relationships = relationshipResult.data || [];
  const studentRelationship = relationships.find((item) => relation(item, "portal_people")?.person_type === "student");
  const guardianRelationships = relationships
    .filter((item) => relation(item, "portal_people")?.person_type !== "student")
    .sort((a, b) => Number(Boolean(b.primary_contact)) - Number(Boolean(a.primary_contact)) || String(a.created_at).localeCompare(String(b.created_at)))
    .slice(0, 4);
  const personIds = [...new Set([
    studentRelationship?.person_id,
    ...guardianRelationships.map((item) => item.person_id),
  ].filter(Boolean))];

  let contacts = [];
  if (personIds.length) {
    const { data, error } = await supabaseAdmin
      .from("portal_contact_methods")
      .select("person_id,contact_type,contact_purpose,value_display,value_normalized,verification_status,created_at")
      .in("person_id", personIds)
      .order("created_at", { ascending: true });
    if (error) throw error;
    contacts = data || [];
  }

  const contactsFor = (personId) => contacts.filter((contact) => contact.person_id === personId);
  const studentContacts = contactsFor(studentRelationship?.person_id);
  const personalEmail = activeContacts(studentContacts, "email", "personal_backup")[0]?.value_display || "";
  const mobile = activeContacts(studentContacts, "phone", "emergency_mobile")[0]?.value_display || student.cell_phone || "";
  const guardians = guardianRelationships.map((relationship) => {
    const person = relation(relationship, "portal_people");
    const personContacts = contactsFor(relationship.person_id);
    return {
      personId: relationship.person_id,
      name: person?.display_name || "",
      relationship: relationship.role || "",
      email: activeContacts(personContacts, "email")[0]?.value_display || "",
      phone: activeContacts(personContacts, "phone")[0]?.value_display || "",
      primary: Boolean(relationship.primary_contact),
      emergency: Boolean(relationship.emergency_contact),
      status: relationship.relationship_status,
    };
  });

  const profile = profileResult.data;
  const enrollment = enrollmentResult.data;
  const music = musicResult.data;
  const background = backgroundResult.data;
  const measurement = measurementResult.data;
  const support = supportResult.data;
  const progress = progressResult.data;
  const currentSchool = relation(enrollment, "portal_schools");
  const primaryInstrument = relation(music, "portal_instrument_types");
  const priorSchool = relation(background, "portal_schools");

  let originSchool = "";
  if (background?.no_previous_music_program) originSchool = "no_previous";
  else if (background?.external_school_name) originSchool = "outside_county";
  else if (priorSchool?.code) originSchool = priorSchool.code;

  const form = {
    preferredFirst: student.preferred_first || "",
    pronunciation: profile?.name_pronunciation || "",
    pronouns: profile?.pronouns || "",
    personalEmail,
    mobile,
    guardianCount: Math.max(2, guardians.length || 1),
    primaryInstrument: music?.primary_instrument_none ? "None" : primaryInstrument?.name || "",
    otherInstruments: (otherInstrumentResult.data || []).map((item) => relation(item, "portal_instrument_types")?.name).filter(Boolean),
    yearsPlaying: music?.years_playing || "",
    interests: (interestResult.data || []).map((item) => relation(item, "portal_interest_types")?.name).filter(Boolean),
    originSchool,
    priorSchoolName: background?.external_school_name || "",
    priorSchoolCity: background?.external_city || "",
    priorSchoolState: background?.external_state || "",
    shirtSize: measurement?.shirt_size || "",
    instrumentAccess: music?.instrument_access || "not_sure",
    supportAreas: support?.areas || [],
    studentNote: support?.note || "",
    accurate: false,
  };
  for (let index = 0; index < 4; index += 1) {
    const guardian = guardians[index] || {};
    const number = index + 1;
    form[`guardian${number}PersonId`] = guardian.personId || "";
    form[`guardian${number}Name`] = guardian.name || "";
    form[`guardian${number}Relationship`] = guardian.relationship || (number === 1 ? "Parent/guardian" : "");
    form[`guardian${number}Email`] = guardian.email || "";
    form[`guardian${number}Phone`] = guardian.phone || "";
  }

  return {
    formVersion: ONBOARDING_FORM_VERSION,
    official: {
      studentId,
      legalName: [student.legal_first, student.legal_last].filter(Boolean).join(" ") || student.display_name,
      currentSchool: currentSchool?.name || "Not connected yet",
      grade: value(enrollment?.grade || student.grade_fall26),
      schoolEmail: student.school_email || "Not connected yet",
      source: enrollment?.source || student.source || "current roster",
      asOf: enrollment?.updated_at || student.updated_at,
    },
    guardians,
    form,
    progress: {
      lastCompletedStep: Number(progress?.last_completed_step || 0),
      status: progress?.completion_status || "not_started",
      updatedAt: progress?.updated_at || null,
    },
    completion: completionResult.data || null,
  };
}
