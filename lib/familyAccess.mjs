// Which trusted links let a signed-in adult act for a student in the Family Portal (#114, #241).
// A link row (already filtered to trusted relationships and active students) qualifies when the
// adult is a guardian with legacy, medium or high assurance, or the student's own record with high
// assurance. The portal shows a student for every trusted link, so billing and notes use this same
// rule; a stricter billing rule left legacy guardians seeing "Nothing is due" with no way to pay.
export const FAMILY_GUARDIAN_ASSURANCE = Object.freeze(["legacy", "medium", "high"]);

export function familyEligibleLink(row) {
  const person = Array.isArray(row?.portal_people) ? row.portal_people[0] : row?.portal_people;
  if (person?.person_type === "student") return row.assurance_level === "high";
  return person?.person_type === "guardian" && FAMILY_GUARDIAN_ASSURANCE.includes(row?.assurance_level);
}
