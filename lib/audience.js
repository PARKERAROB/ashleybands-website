import { supabaseAdmin } from "./supabaseAdmin.js";

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

// Active student ids in the roster. Inactive students stay in the portal for
// history, billing, and audit, but they are never a broadcast audience.
export async function allStudentIds(client = supabaseAdmin) {
  const { data } = await client
    .from("portal_students")
    .select("id")
    .eq("status", "active");
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

async function studentIdsWithProgramGroup(values, client) {
  let query = client
    .from("program_memberships")
    .select("student_id,program_groups!inner(code,status)")
    .is("ends_on", null)
    .eq("program_groups.status", "active");
  if (Array.isArray(values) && values.length) {
    query = query.in("program_groups.code", values);
  }
  const { data } = await query;
  return new Set(uniqueIds(data, "student_id"));
}

async function studentIdsWithSchoolClass(values, client) {
  let query = client
    .from("student_class_enrollments")
    .select("student_id,school_class_sections!inner(code,status)")
    .is("ends_on", null)
    .eq("school_class_sections.status", "active");
  if (Array.isArray(values) && values.length) {
    query = query.in("school_class_sections.code", values);
  }
  const { data } = await query;
  return new Set(uniqueIds(data, "student_id"));
}

// Resolve one predicate to a Set of matching student ids.
async function resolvePredicate(pred, client) {
  const { key, op = "in", values = [] } = pred || {};
  if (!key) return new Set();

  let matched;
  if (key === "student_id") {
    matched = new Set((values || []).map(String).filter(Boolean));
  } else if (key === "program_group") {
    matched = await studentIdsWithProgramGroup(op === "exists" ? null : values, client);
  } else if (key === "school_class") {
    matched = await studentIdsWithSchoolClass(op === "exists" ? null : values, client);
  } else {
    matched = await studentIdsWithAttribute(key, op === "exists" ? null : values, client);
  }

  if (op === "exists") return matched;

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
  const active = new Set(await allStudentIds(client));
  const predicates = (filter && filter.predicates) || [];
  if (!predicates.length) {
    // Everyone who is currently active.
    return [...active];
  }
  const sets = await Promise.all(predicates.map((p) => resolvePredicate(p, client)));
  const combined = (filter.match === "any" ? union(sets) : intersect(sets));
  // Attribute rows are retained historically. Intersect every filtered result
  // with the active roster so an inactive student's old attributes can never
  // put them back into a broadcast.
  return [...combined].filter((id) => active.has(id));
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
  const active = new Set(await allStudentIds(client));
  const [attributesResult, groupsResult, membershipsResult, sectionsResult, enrollmentsResult] = await Promise.all([
    client.from("portal_student_attributes").select("key,value,student_id"),
    client.from("program_groups").select("id,code,name,status").eq("status", "active"),
    client.from("program_memberships").select("group_id,student_id").is("ends_on", null),
    client.from("school_class_sections").select("id,code,name,status").eq("status", "active"),
    client.from("student_class_enrollments").select("section_id,student_id").is("ends_on", null),
  ]);
  const data = attributesResult.data || [];

  const facets = new Map();
  for (const row of data || []) {
    if (!active.has(row.student_id)) continue;
    if (!facets.has(row.key)) facets.set(row.key, new Map());
    const valueMap = facets.get(row.key);
    const set = valueMap.get(row.value) || new Set();
    set.add(row.student_id);
    valueMap.set(row.value, set);
  }

  const normalizedFacets = [];
  const groupById = new Map((groupsResult.data || []).map((group) => [group.id, group]));
  const groupCounts = new Map();
  for (const membership of membershipsResult.data || []) {
    if (!active.has(membership.student_id) || !groupById.has(membership.group_id)) continue;
    const students = groupCounts.get(membership.group_id) || new Set();
    students.add(membership.student_id);
    groupCounts.set(membership.group_id, students);
  }
  if (groupCounts.size) {
    normalizedFacets.push({
      key: "program_group",
      label: "Program group",
      values: [...groupCounts.entries()].map(([id, students]) => {
        const group = groupById.get(id);
        return { value: group.code, label: group.name, count: students.size };
      }).sort((left, right) => left.label.localeCompare(right.label)),
    });
  }

  const sectionById = new Map((sectionsResult.data || []).map((section) => [section.id, section]));
  const sectionCounts = new Map();
  for (const enrollment of enrollmentsResult.data || []) {
    if (!active.has(enrollment.student_id) || !sectionById.has(enrollment.section_id)) continue;
    const students = sectionCounts.get(enrollment.section_id) || new Set();
    students.add(enrollment.student_id);
    sectionCounts.set(enrollment.section_id, students);
  }
  if (sectionCounts.size) {
    normalizedFacets.push({
      key: "school_class",
      label: "School class",
      values: [...sectionCounts.entries()].map(([id, students]) => {
        const section = sectionById.get(id);
        return { value: section.code, label: section.name, count: students.size };
      }).sort((left, right) => left.label.localeCompare(right.label)),
    });
  }

  return [...normalizedFacets, ...[...facets.entries()]
    .map(([key, valueMap]) => ({
      key,
      label: key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      values: [...valueMap.entries()]
        .map(([value, students]) => ({ value, label: value, count: students.size }))
        .sort((a, b) => a.value.localeCompare(b.value))
    }))
    .sort((a, b) => a.key.localeCompare(b.key))];
}
