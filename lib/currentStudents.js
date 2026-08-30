import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadStudentLedgers } from "@/lib/billing";

const INACTIVE_STATUSES = ["inactive", "inactive-dropped", "inactive-graduated", "inactive-moved"];
const CLOSED_CONTACT_STATUSES = new Set(["hard_bounce", "replaced", "superseded"]);

function value(input) {
  return String(input || "").trim();
}

function splitValues(input) {
  return value(input)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function chunks(values, size = 40) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function isMarching(valueToCheck) {
  return ["yes", "active", "marching", "true", "1"].includes(value(valueToCheck).toLowerCase());
}

function legalName(student) {
  return [student.legal_first, student.legal_last].filter(Boolean).join(" ").trim() || student.display_name;
}

function statusView(status) {
  return status === "active" ? "active" : "inactive";
}

function inactiveReason(status) {
  const reasons = {
    "inactive-dropped": "Inactive",
    "inactive-graduated": "Graduated",
    "inactive-moved": "Moved",
  };
  return reasons[status] || "Inactive";
}

function currentEnsembles(student) {
  const ensembles = splitValues(student.ensemble_2026);
  if (isMarching(student.marching_2026)) ensembles.push("Marching Band");
  return [...new Set(ensembles)];
}

function activeContacts(contacts) {
  return (contacts || []).filter((contact) => !CLOSED_CONTACT_STATUSES.has(contact.verification_status));
}

function mapContactValues(contacts, type) {
  return [...new Set(activeContacts(contacts)
    .filter((contact) => contact.contact_type === type)
    .map((contact) => value(contact.value_display))
    .filter(Boolean))];
}

function buildGuardian(link, contactsByPerson) {
  const person = link.portal_people;
  const contacts = contactsByPerson[person.id] || [];
  return {
    id: person.id,
    name: person.display_name,
    relationship: value(link.role) || "Guardian",
    primary: Boolean(link.primary_contact),
    emails: mapContactValues(contacts, "email"),
    phones: mapContactValues(contacts, "phone"),
  };
}

function buildStudent(student, guardians, studentContacts, openInstrumentRequest, supportRequest) {
  const sortedGuardians = [...guardians].sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
  const primaryGuardian = sortedGuardians[0] || null;
  const schoolEmail = value(student.school_email);
  const mobile = value(student.cell_phone) || mapContactValues(studentContacts, "phone")[0] || "";
  const personalEmails = mapContactValues(studentContacts, "email").filter((email) => email.toLowerCase() !== schoolEmail.toLowerCase());
  const needs = [];
  if (!schoolEmail || !primaryGuardian?.emails[0] || !primaryGuardian?.phones[0]) needs.push("Contact");
  if (openInstrumentRequest) needs.push("Instrument");
  for (const area of supportRequest?.areas || []) {
    const normalized = area === "Instrument or equipment" ? "Instrument" : area === "Class schedule" ? "Schedule" : area;
    if (normalized && !needs.includes(normalized)) needs.push(normalized);
  }

  return {
    id: student.id,
    sourceStudentId: student.source_student_id,
    status: statusView(student.status),
    statusValue: student.status,
    inactiveReason: inactiveReason(student.status),
    displayName: student.display_name,
    legalName: legalName(student),
    preferredFirst: value(student.preferred_first),
    grade: value(student.grade_fall26) || "Not listed",
    schoolEmail,
    personalEmail: personalEmails[0] || "",
    mobile,
    guardians: sortedGuardians,
    guardian: primaryGuardian ? {
      name: primaryGuardian.name,
      relationship: primaryGuardian.relationship,
      email: primaryGuardian.emails[0] || "",
      phone: primaryGuardian.phones[0] || "",
    } : { name: "", relationship: "", email: "", phone: "" },
    ensembles: currentEnsembles(student),
    bandClass: value(student.band_class_2026),
    programInstrument: value(student.instrument_2026) || value(student.mb_role_2026) || "Not listed",
    marchingRole: value(student.mb_role_2026),
    needs,
    updatedAt: student.updated_at || null,
  };
}

async function loadRows() {
  const { data, error } = await supabaseAdmin
    .from("portal_students")
    .select("id,source_student_id,legal_first,legal_last,preferred_first,display_name,grade_fall26,school_email,cell_phone,status,band_class_2026,ensemble_2026,instrument_2026,marching_2026,mb_role_2026,updated_at")
    .order("legal_last", { ascending: true })
    .order("legal_first", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return data || [];
}

async function loadPeople(studentIds) {
  if (!studentIds.length) return { guardiansByStudent: {}, studentContactsByStudent: {} };
  const linkResults = await Promise.all(chunks(studentIds).map((studentChunk) => supabaseAdmin
    .from("portal_student_people")
    .select("student_id,role,primary_contact,relationship_status,portal_people(id,display_name,person_type)")
    .in("student_id", studentChunk)
    .eq("relationship_status", "trusted")));
  const linkError = linkResults.find((result) => result.error)?.error;
  if (linkError) throw new Error(linkError.message);
  const links = linkResults.flatMap((result) => result.data || []);

  const validLinks = (links || []).filter((link) => link.portal_people);
  const personIds = [...new Set(validLinks.map((link) => link.portal_people.id))];
  let contactsByPerson = {};
  if (personIds.length) {
    const contactResults = await Promise.all(chunks(personIds).map((personChunk) => supabaseAdmin
      .from("portal_contact_methods")
      .select("person_id,contact_type,value_display,verification_status")
      .in("person_id", personChunk)));
    const contactError = contactResults.find((result) => result.error)?.error;
    if (contactError) throw new Error(contactError.message);
    const contacts = contactResults.flatMap((result) => result.data || []);
    contactsByPerson = (contacts || []).reduce((result, contact) => {
      (result[contact.person_id] ||= []).push(contact);
      return result;
    }, {});
  }

  const guardiansByStudent = {};
  const studentContactsByStudent = {};
  for (const link of validLinks) {
    if (link.portal_people.person_type === "student") {
      studentContactsByStudent[link.student_id] = contactsByPerson[link.portal_people.id] || [];
    } else {
      (guardiansByStudent[link.student_id] ||= []).push(buildGuardian(link, contactsByPerson));
    }
  }
  return { guardiansByStudent, studentContactsByStudent };
}

async function loadOpenInstrumentRequests(studentIds) {
  if (!studentIds.length) return new Set();
  const results = await Promise.all(chunks(studentIds).map((studentChunk) => supabaseAdmin
    .from("portal_instrument_requests")
    .select("student_id,status")
    .in("student_id", studentChunk)
    .in("status", ["submitted", "assigned"])));
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  const data = results.flatMap((result) => result.data || []);
  return new Set((data || []).filter((row) => row.status === "submitted").map((row) => row.student_id));
}

async function loadOpenSupportRequests(studentIds) {
  if (!studentIds.length) return {};
  const results = await Promise.all(chunks(studentIds).map((studentChunk) => supabaseAdmin
    .from("portal_support_requests")
    .select("id,student_id,areas,status,updated_at")
    .in("student_id", studentChunk)
    .eq("status", "open")));
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  const byStudent = {};
  for (const row of results.flatMap((result) => result.data || [])) {
    if (!byStudent[row.student_id] || String(row.updated_at).localeCompare(String(byStudent[row.student_id].updated_at)) > 0) {
      byStudent[row.student_id] = row;
    }
  }
  return byStudent;
}

export async function loadCurrentStudents(view = "active") {
  const rows = await loadRows();
  const visible = rows.filter((student) => view === "inactive"
    ? INACTIVE_STATUSES.includes(student.status)
    : student.status === "active");
  const ids = visible.map((student) => student.id);
  const [{ guardiansByStudent, studentContactsByStudent }, openRequests, supportRequests] = await Promise.all([
    loadPeople(ids),
    loadOpenInstrumentRequests(ids),
    loadOpenSupportRequests(ids),
  ]);
  const students = visible.map((student) => buildStudent(
    student,
    guardiansByStudent[student.id] || [],
    studentContactsByStudent[student.id] || [],
    openRequests.has(student.id),
    supportRequests[student.id] || null,
  ));
  const counts = rows.reduce((result, student) => {
    result[statusView(student.status)] += 1;
    return result;
  }, { active: 0, inactive: 0 });
  const updatedAt = students.map((student) => student.updatedAt).filter(Boolean).sort().at(-1) || null;
  return { students, counts, updatedAt };
}

export async function loadStudent360(studentId) {
  const roster = await loadCurrentStudents("active");
  let student = roster.students.find((item) => item.id === studentId);
  if (!student) {
    const inactive = await loadCurrentStudents("inactive");
    student = inactive.students.find((item) => item.id === studentId);
  }
  if (!student) return null;

  const [resourcesResult, instrumentsResult, requestsResult, attendanceResult, sponsorResult, profileResult, musicResult, otherInstrumentsResult, interestsResult, enrollmentResult, backgroundResult, supportResult, completionResult, membershipsResult, ledgers] = await Promise.all([
    supabaseAdmin.from("portal_student_resources")
      .select("locker_number,tuner_number,tuner_shared_with,assignment_status,updated_at")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabaseAdmin.from("instrument_inventory")
      .select("id,instrument_type,brand,model_markings,serial_number,issued_at,issued_condition,review_status")
      .eq("assigned_student_id", studentId),
    supabaseAdmin.from("portal_instrument_requests")
      .select("id,status,school_year,submitted_at,updated_at")
      .eq("student_id", studentId)
      .order("submitted_at", { ascending: false }),
    supabaseAdmin.from("attendance_observations")
      .select("status,arrived_at,departed_at,updated_at,attendance_events(id,title,starts_at,occurrence_key)")
      .eq("portal_student_id", studentId),
    supabaseAdmin.from("sponsor_gifts")
      .select("amount_cents,status")
      .eq("portal_student_id", studentId)
      .eq("status", "confirmed"),
    supabaseAdmin.from("portal_student_profiles")
      .select("name_pronunciation,pronouns,updated_at")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabaseAdmin.from("portal_student_music_profiles")
      .select("primary_instrument_none,years_playing,instrument_access,updated_at,portal_instrument_types(name)")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabaseAdmin.from("portal_student_other_instruments")
      .select("portal_instrument_types(name)")
      .eq("student_id", studentId),
    supabaseAdmin.from("portal_student_interests")
      .select("portal_interest_types(name)")
      .eq("student_id", studentId),
    supabaseAdmin.from("portal_student_enrollments")
      .select("grade,school_year,source,updated_at,portal_schools(name)")
      .eq("student_id", studentId)
      .is("ends_on", null)
      .maybeSingle(),
    supabaseAdmin.from("portal_student_school_background")
      .select("external_school_name,external_city,external_state,no_previous_music_program,portal_schools(name)")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabaseAdmin.from("portal_support_requests")
      .select("id,areas,note,status,updated_at")
      .eq("student_id", studentId)
      .eq("status", "open")
      .order("updated_at", { ascending: false }),
    supabaseAdmin.from("portal_onboarding_completions")
      .select("form_version,first_submitted_at,last_confirmed_at,revision")
      .eq("student_id", studentId)
      .order("last_confirmed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    student.status === "active" ? supabaseAdmin.from("program_memberships")
      .select("id,membership_role,source,program_groups(id,name,group_type,status,ends_on)")
      .eq("student_id", studentId)
      .is("ends_on", null) : Promise.resolve({ data: [], error: null }),
    loadStudentLedgers([studentId]),
  ]);

  for (const result of [resourcesResult, instrumentsResult, requestsResult, attendanceResult, sponsorResult, profileResult, musicResult, otherInstrumentsResult, interestsResult, enrollmentResult, backgroundResult, supportResult, completionResult, membershipsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const charges = ledgers.charges[studentId] || [];
  const payments = ledgers.payments[studentId] || [];
  const balance = ledgers.balances[studentId] || { charged_cents: 0, paid_cents: 0, balance_cents: 0 };
  const attendanceRows = attendanceResult.data || [];
  const attendance = attendanceRows.reduce((summary, row) => {
    summary.total += 1;
    if (row.status && Object.hasOwn(summary, row.status)) summary[row.status] += 1;
    else summary.unmarked += 1;
    return summary;
  }, { total: 0, present: 0, tardy: 0, absent: 0, unmarked: 0 });
  const confirmedSponsorshipCents = (sponsorResult.data || []).reduce(
    (total, gift) => total + (Number(gift.amount_cents) || 0), 0,
  );
  const creditedSponsorshipCents = payments
    .filter((payment) => payment.status === "completed" && payment.is_sponsorship)
    .reduce((total, payment) => total + (Number(payment.amount_cents) || 0), 0);
  const one = (row, key) => Array.isArray(row?.[key]) ? row[key][0] || null : row?.[key] || null;
  const musicInstrument = one(musicResult.data, "portal_instrument_types");
  const currentSchool = one(enrollmentResult.data, "portal_schools");
  const priorSchool = one(backgroundResult.data, "portal_schools");
  const previousSchool = backgroundResult.data?.no_previous_music_program
    ? "No previous school music program"
    : backgroundResult.data?.external_school_name
      ? [backgroundResult.data.external_school_name, backgroundResult.data.external_city, backgroundResult.data.external_state].filter(Boolean).join(" · ")
      : priorSchool?.name || "Not provided";
  const programMemberships = (membershipsResult.data || []).map((membership) => {
    const group = one(membership, "program_groups");
    if (!group || group.status !== "active" || group.ends_on) return null;
    return {
      id: membership.id,
      groupId: group.id,
      name: group.name,
      type: group.group_type,
      role: value(membership.membership_role),
      source: membership.source,
    };
  }).filter(Boolean).sort((left, right) => left.name.localeCompare(right.name));

  return {
    ...student,
    resources: resourcesResult.data ? {
      lockerNumber: value(resourcesResult.data.locker_number),
      tunerNumber: value(resourcesResult.data.tuner_number),
      tunerSharedWith: value(resourcesResult.data.tuner_shared_with),
      assignmentStatus: value(resourcesResult.data.assignment_status),
      updatedAt: resourcesResult.data.updated_at,
    } : null,
    instruments: instrumentsResult.data || [],
    instrumentRequests: requestsResult.data || [],
    attendance,
    recentAttendance: attendanceRows
      .filter((row) => row.attendance_events)
      .sort((a, b) => String(b.attendance_events.starts_at).localeCompare(String(a.attendance_events.starts_at)))
      .slice(0, 5),
    finances: {
      chargedCents: Number(balance.charged_cents) || 0,
      paidCents: Number(balance.paid_cents) || 0,
      balanceCents: Number(balance.balance_cents) || 0,
      confirmedSponsorshipCents,
      creditedSponsorshipCents,
      charges: charges.length,
      payments: payments.length,
    },
    profile: {
      namePronunciation: value(profileResult.data?.name_pronunciation),
      pronouns: value(profileResult.data?.pronouns),
    },
    enrollment: {
      currentSchool: currentSchool?.name || "Not connected yet",
      grade: value(enrollmentResult.data?.grade || student.grade),
      schoolYear: value(enrollmentResult.data?.school_year),
      source: value(enrollmentResult.data?.source),
    },
    musicBackground: {
      primaryInstrument: musicResult.data?.primary_instrument_none ? "None" : musicInstrument?.name || "Not provided",
      otherInstruments: (otherInstrumentsResult.data || []).map((row) => one(row, "portal_instrument_types")?.name).filter(Boolean),
      yearsPlaying: value(musicResult.data?.years_playing) || "Not provided",
      interests: (interestsResult.data || []).map((row) => one(row, "portal_interest_types")?.name).filter(Boolean),
      previousSchool,
      instrumentAccess: value(musicResult.data?.instrument_access) || "Not provided",
    },
    supportRequests: supportResult.data || [],
    onboarding: completionResult.data || null,
    programMemberships,
    forms: { available: false },
  };
}
