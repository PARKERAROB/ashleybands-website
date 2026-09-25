// What a roster sync would write to an existing hosted portal row, given the
// family-owned overlay. `--apply` writes these rows and `--check` compares them
// with hosted rows, so the drift check reports exactly what apply would change
// (#116). Pure functions; no database access.

// Record-keeping columns. A difference here alone is not drift: source_row_hash
// hashes the whole roster row, including roster-only columns never mirrored.
export const PROVENANCE_FIELDS = new Set(["source", "source_row_hash", "last_seen_sync_id"]);

// Portal columns the roster sync never writes on an existing student. notes is
// the family-visible "Family notes" field; roster staff notes stay private (#117).
const FAMILY_STUDENT_COLUMNS = ["cell_phone", "notes"];

const PARTICIPATION_COLUMNS = [
  "band_period_2026",
  "ensemble_2026",
  "instrument_2026",
  "marching_2026",
  "marching_role_category_2026",
  "marching_assignment_2026"
];

// Family edits auto-apply (docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md).
// An approved request marks the edited value as family-owned until the roster
// adopts it through its own merge.
export function familyOverlay(updateRequests = []) {
  const approved = updateRequests.filter((row) => row.status === "approved");
  const studentsWith = (...fields) => new Set(
    approved.filter((row) => fields.includes(row.field_name) && row.student_id).map((row) => row.student_id)
  );
  const targetsWith = (...fields) => new Set(
    approved.filter((row) => fields.includes(row.field_name) && row.target_id).map((row) => row.target_id)
  );
  return {
    preferredName: studentsWith("student_preferred_first"),
    participation: studentsWith("participation_bundle"),
    personName: targetsWith("person_display_name", "edit_guardian"),
    guardianRole: targetsWith("edit_guardian")
  };
}

export function plannedStudentUpdate(row, existing, overlay) {
  const planned = { ...row };
  for (const column of FAMILY_STUDENT_COLUMNS) delete planned[column];
  if (overlay.preferredName.has(existing.id)) {
    planned.preferred_first = existing.preferred_first;
    planned.display_name = [existing.preferred_first || planned.legal_first, planned.legal_last]
      .filter(Boolean)
      .join(" ")
      .trim() || existing.display_name;
  }
  if (overlay.participation.has(existing.id)) {
    for (const column of PARTICIPATION_COLUMNS) planned[column] = existing[column];
  }
  return planned;
}

export function plannedPersonUpdate(row, existing, overlay) {
  const planned = { ...row };
  if (overlay.personName.has(existing.id)) {
    planned.display_name = existing.display_name;
    planned.first_name = existing.first_name;
    planned.last_name = existing.last_name;
  }
  return planned;
}

const ROSTER_LINK_SOURCES = new Set(["bdos_parents_csv", "bdos_students_csv"]);

// Guardian relationships are family-owned once the portal writes them
// (onboarding, access requests, guardian edits): keep role, primary contact,
// status and source. A link a family or staff member removed stays removed;
// the roster never re-grants access. A blank roster role never erases a hosted one.
export function plannedRelationshipUpdate(row, existing, overlay) {
  const planned = { ...row };
  if (!existing) return planned;
  if (existing.source && !ROSTER_LINK_SOURCES.has(existing.source)) {
    for (const field of ["role", "primary_contact", "relationship_status", "source"]) planned[field] = existing[field];
    return planned;
  }
  if (existing.relationship_status && existing.relationship_status !== "trusted") {
    planned.relationship_status = existing.relationship_status;
    planned.primary_contact = existing.primary_contact;
  }
  if (!planned.role || overlay.guardianRole.has(existing.person_id)) planned.role = existing.role;
  return planned;
}

const comparable = (value) => (value === undefined || value === "" ? null : value);

export function mirrorFieldDiff(planned, hosted) {
  const changed = [];
  for (const [field, value] of Object.entries(planned)) {
    if (PROVENANCE_FIELDS.has(field)) continue;
    if (comparable(value) !== comparable(hosted?.[field])) changed.push(field);
  }
  return changed;
}

export function overlayFields(row, planned) {
  return Object.keys(planned).filter((field) =>
    !PROVENANCE_FIELDS.has(field) && comparable(planned[field]) !== comparable(row[field])
  );
}

const ROSTER_CONTACT_SOURCES = new Set(["bdos_students_csv", "bdos_roster_seed"]);

// Roster-seeded school addresses the roster has since withdrawn or replaced,
// still able to receive a login code. Sync only adds these rows, so a roster
// correction leaves the old one active. Family-verified rows are not counted.
export function withdrawnSchoolEmailContacts(contacts, sourceStudentIdByPersonId, rosterSchoolEmailBySourceId) {
  return contacts.filter((row) => {
    if (row.contact_type !== "email" || row.verification_status !== "unverified") return false;
    if (!ROSTER_CONTACT_SOURCES.has(row.source)) return false;
    if (!String(row.value_normalized || "").endsWith("@student.nhcs.net")) return false;
    const sourceStudentId = sourceStudentIdByPersonId.get(row.person_id);
    if (!sourceStudentId || !rosterSchoolEmailBySourceId.has(sourceStudentId)) return false;
    return rosterSchoolEmailBySourceId.get(sourceStudentId) !== row.value_normalized;
  });
}

const ADMIN_NOTE_STAMP = /^(added via admin by|created from mb signup by) /;
const noteText = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

// Hosted family-visible notes that are copies of roster staff notes or admin
// creation stamps (#117). Must stay zero.
export function staffNotesVisibleToFamilies(hostedStudents, rosterStudents) {
  const rosterNotes = new Map(rosterStudents.map((row) => [row.id, noteText(row.notes)]));
  return hostedStudents.filter((row) => {
    const note = noteText(row.notes);
    if (!note) return false;
    return note === rosterNotes.get(row.source_student_id) || ADMIN_NOTE_STAMP.test(note);
  });
}
