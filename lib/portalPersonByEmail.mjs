// One email can sit on several person rows (old roster seeds, earlier access requests).
// Sign-in, access-request confirm and guardian add all resolve an email through this
// pick so they land on the same person: one with a trusted student link, else the oldest.
export async function findPersonByEmail(client, email) {
  const { data: contacts, error } = await client
    .from("portal_contact_methods")
    .select("id, person_id, created_at, portal_people(person_type)")
    .eq("contact_type", "email")
    .eq("value_normalized", email)
    .not("verification_status", "in", "(hard_bounce,replaced,superseded)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!contacts?.length) return null;

  const pick = (c) => ({ contactId: c.id, personId: c.person_id, personType: c.portal_people?.person_type || null });
  if (contacts.length === 1) return pick(contacts[0]);

  const { data: links, error: linkError } = await client
    .from("portal_student_people")
    .select("person_id")
    .in("person_id", contacts.map((c) => c.person_id))
    .eq("relationship_status", "trusted");
  if (linkError) throw linkError;
  const linked = new Set((links || []).map((l) => l.person_id));
  return pick(contacts.find((c) => linked.has(c.person_id)) || contacts[0]);
}
