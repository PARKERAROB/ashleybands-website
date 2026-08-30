export function familyName(student) {
  return String(student.legalName || student.displayName || "").trim().split(/\s+/).at(-1) || "";
}

export function compareMembershipStudents(left, right, sort, membershipCount = () => 0) {
  if (sort === "last") return familyName(left).localeCompare(familyName(right)) || left.displayName.localeCompare(right.displayName);
  if (sort === "grade") return Number(left.grade) - Number(right.grade) || left.displayName.localeCompare(right.displayName);
  if (sort === "memberships") return membershipCount(right) - membershipCount(left) || left.displayName.localeCompare(right.displayName);
  return left.displayName.localeCompare(right.displayName);
}

export function sourceLabel(source) {
  if (source === "bdos_csv_projection") return "Roster projection";
  if (source === "infinite_campus_import") return "Infinite Campus import";
  if (source === "staff_program_map") return "Staff managed";
  return "Connected record";
}

export function matchesMembershipStudent(student, filters) {
  const term = String(filters.search || "").trim().toLowerCase();
  const haystack = [
    student.displayName,
    student.legalName,
    student.grade,
    student.instrument,
    ...(filters.groupNames || []),
    ...(filters.sectionNames || []),
  ].join(" ").toLowerCase();
  return (!term || haystack.includes(term))
    && (filters.groupIds || [filters.groupId].filter(Boolean)).every((groupId) => student.groupIds.includes(groupId))
    && (!filters.sectionId || student.sectionIds.includes(filters.sectionId))
    && (!filters.grade || student.grade === filters.grade)
    && (!filters.instrument || student.instrument === filters.instrument);
}
