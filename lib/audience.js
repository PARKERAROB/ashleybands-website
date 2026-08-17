import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Audience resolver for the broadcast composer.
//
// An audience_filter is a list of predicates over student attributes
// (portal_student_attributes), combined with a top-level AND/OR. The resolver
// turns it into a set of student ids, then expands those students to recipient
// emails along an axis (the students themselves, their guardians, or both).
//
// Filter shape (jsonb on broadcasts.audience_filter):
//   { match: "all" | "any", predicates: [ { key, op, values? } ] }
//   op: "in"      -> student has key with a value in values
//       "not_in"  -> student does NOT have key with a value in values
//       "exists"  -> student has any value for key
//   Empty/absent predicates => everyone (all families). This is the Phase 1
//   season-critical default.
//
// Contact methods that are dead (bounced/replaced/superseded) are excluded.
// Everything else is included to maximize reach; verified addresses are preferred
// only for dedupe ordering.

const DEAD_CONTACT_STATUSES = new Set([
  "hard_bounce",
  "replaced",
  "superseded"
]);

const VERIFIED_PREFIX = "verified_";

function uniqueIds(rows, key) {
  return [...new Set((rows || []).map((r) => r[key]).filter(Boolean))];
}

// All student ids in the roster. The base set for "everyone" and for not_in.
export async function allStudentIds(client = supabaseAdmin) {
  const { data } = await client.from("portal_students").select("id");
  return (data || []).map((r) => r.id).filter(Boolean);
}

// Student ids that have (key) with a value in (values).
async function studentIdsWithAttribute(key, values, client) {
  let query = client
    .from("portal_student_attributes")
    .select("student_id")
    .eq("key", key);
  if (Array.isArray(values) && values.length) {
    query = query.in("value", values);
  }
  const { data } = await query;
  return new Set(uniqueIds(data, "student_id"));
}

// Resolve one predicate to a Set of matching student ids.
async function resolvePredicate(pred, client) {
  const { key, op = "in", values = [] } = pred || {};
  if (!key) return new Set();

  if (op === "exists") {
    return studentIdsWithAttribute(key, null, client);
  }

  const matched = await studentIdsWithAttribute(key, values, client);

  if (op === "not_in") {
    const all = await allStudentIds(client);
    return new Set(all.filter((id) => !matched.has(id)));
  }

  // default: "in"
  return matched;
}

function intersect(sets) {
  if (!sets.length) return new Set();
  return sets.reduce((acc, set) => new Set([...acc].filter((id) => set.has(id))));
}

function union(sets) {
  const out = new Set();
  for (const set of sets) for (const id of set) out.add(id);
  return out;
}

// Filter -> array of student ids.
export async function resolveStudentIds(filter, client = supabaseAdmin) {
  const predicates = (filter && filter.predicates) || [];
  if (!predicates.length) {
    // Everyone.
    return allStudentIds(client);
  }
  const sets = await Promise.all(predicates.map((p) => resolvePredicate(p, client)));
  const combined = (filter.match === "any" ? union(sets) : intersect(sets));
  return [...combined];
}

// Student own emails (school_email). Note: these are NHCS addresses on the
// Microsoft migration; guardians (personal email) are the durable audience.
async function studentSelfRecipients(studentIds, client) {
  if (!studentIds.length) return [];
  const { data } = await client
    .from("portal_students")
    .select("id, school_email")
    .in("id", studentIds);
  return (data || [])
    .filter((r) => r.school_email && r.school_email.includes("@"))
    .map((r) => ({
      student_id: r.id,
      person_id: null,
      email: r.school_email.trim(),
      verified: false
    }));
}

// Trusted-guardian emails for the given students.
async function guardianRecipients(studentIds, client) {
  if (!studentIds.length) return [];

  const { data: links } = await client
    .from("portal_student_people")
    .select("student_id, person_id, portal_people(person_type)")
    .in("student_id", studentIds)
    .eq("relationship_status", "trusted");

  // Older imported adult records may still be typed "unknown". Exclude only
  // explicit student self-records so guardian broadcasts do not leak onto the
  // student axis while trusted legacy adults remain reachable.
  const guardianLinks = (links || []).filter((link) => link.portal_people?.person_type !== "student");
  const personIds = uniqueIds(guardianLinks, "person_id");
  if (!personIds.length) return [];

  const { data: contacts } = await client
    .from("portal_contact_methods")
    .select("person_id, value_display, value_normalized, verification_status")
    .in("person_id", personIds)
    .eq("contact_type", "email");

  const emailsByPerson = new Map();
  for (const c of contacts || []) {
    if (DEAD_CONTACT_STATUSES.has(c.verification_status)) continue;
    const list = emailsByPerson.get(c.person_id) || [];
    list.push({
      email: (c.value_display || c.value_normalized || "").trim(),
      verified: String(c.verification_status || "").startsWith(VERIFIED_PREFIX)
    });
    emailsByPerson.set(c.person_id, list);
  }

  const out = [];
  for (const link of guardianLinks) {
    for (const c of emailsByPerson.get(link.person_id) || []) {
      if (!c.email || !c.email.includes("@")) continue;
      out.push({
        student_id: link.student_id,
        person_id: link.person_id,
        email: c.email,
        verified: c.verified
      });
    }
  }
  return out;
}

// Dedupe by lowercased email; keep the verified row when duplicated.
function dedupeRecipients(recipients) {
  const byEmail = new Map();
  for (const r of recipients) {
    const norm = r.email.toLowerCase();
    const existing = byEmail.get(norm);
    if (!existing || (r.verified && !existing.verified)) {
      byEmail.set(norm, r);
    }
  }
  return [...byEmail.values()];
}

// Full resolution: filter + axis -> { recipients, count, studentCount }.
// recipients: [{ student_id, person_id, email }]
export async function resolveAudience(filter, axis = "guardians", client = supabaseAdmin) {
  const studentIds = await resolveStudentIds(filter, client);
  if (!studentIds.length) {
    return { recipients: [], count: 0, studentCount: 0, coveredStudentCount: 0 };
  }

  const parts = [];
  if (axis === "students" || axis === "both") {
    parts.push(...(await studentSelfRecipients(studentIds, client)));
  }
  if (axis === "guardians" || axis === "both") {
    parts.push(...(await guardianRecipients(studentIds, client)));
  }

  const recipients = dedupeRecipients(parts).map(({ student_id, person_id, email }) => ({
    student_id,
    person_id,
    email
  }));

  const coveredStudentCount = new Set(parts.map((row) => row.student_id).filter(Boolean)).size;
  return { recipients, count: recipients.length, studentCount: studentIds.length, coveredStudentCount };
}

// Distinct attribute keys + their values + student counts, for the picker UI.
// The audience picker is GENERATED from this — add an attribute, it shows up here.
export async function loadAttributeFacets(client = supabaseAdmin) {
  const { data } = await client
    .from("portal_student_attributes")
    .select("key, value, student_id");

  const facets = new Map();
  for (const row of data || []) {
    if (!facets.has(row.key)) facets.set(row.key, new Map());
    const valueMap = facets.get(row.key);
    const set = valueMap.get(row.value) || new Set();
    set.add(row.student_id);
    valueMap.set(row.value, set);
  }

  return [...facets.entries()]
    .map(([key, valueMap]) => ({
      key,
      values: [...valueMap.entries()]
        .map(([value, students]) => ({ value, count: students.size }))
        .sort((a, b) => a.value.localeCompare(b.value))
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
