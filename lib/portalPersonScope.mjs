const STRONG = new Set(["medium", "high"]);
const CLOSED = new Set(["rejected", "superseded"]);

// A portal person's name and contact methods are shared across every student they are
// linked to. A family member may change them only when every open link of that person
// is to a student the editor also holds a trusted, medium or high link to.
export function personWithinActorStudents(targetLinks, actorLinks) {
  const actorStudents = new Set(
    (actorLinks || [])
      .filter((link) => link.relationship_status === "trusted" && STRONG.has(link.assurance_level))
      .map((link) => link.student_id)
  );
  return (targetLinks || [])
    .filter((link) => !CLOSED.has(link.relationship_status))
    .every((link) => actorStudents.has(link.student_id));
}

// A verified email is the person's own sign-in proof. Family edits add a new row
// beside it instead of overwriting or retiring it.
export function isVerifiedContact(contact) {
  return Boolean(contact?.verified_at) || String(contact?.verification_status || "").startsWith("verified");
}
