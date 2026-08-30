import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

function text(v) {
  return String(v || "").trim();
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}
function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// Loads every portal_people row plus their contact methods and linked
// students, shaped for the /admin/contacts screen. ~400 people — one pass,
// no pagination (see the deliverable spec).
async function loadPeopleWithContacts() {
  const { data: people, error: peopleError } = await supabaseAdmin
    .from("portal_people")
    .select("id, display_name, first_name, last_name, person_type, source")
    .order("display_name", { ascending: true });
  if (peopleError) throw peopleError;

  // No .in(person_id, [400+ ids]) filters here: a long .in() list overflows the
  // PostgREST URL and fails silently. Every row belongs to some person anyway —
  // fetch all, group in memory. .range() outgrows the default 1000-row cap.
  let contactsByPerson = {};
  {
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("portal_contact_methods")
      .select(
        "id, person_id, contact_type, value_display, value_normalized, verification_status, verification_source, source"
      )
      .range(0, 9999);
    if (contactsError) throw contactsError;
    contactsByPerson = (contacts || []).reduce((acc, c) => {
      (acc[c.person_id] = acc[c.person_id] || []).push(c);
      return acc;
    }, {});
  }

  let studentsByPerson = {};
  {
    const { data: links, error: linksError } = await supabaseAdmin
      .from("portal_student_people")
      .select("person_id, role, primary_contact, relationship_status, portal_students(id, display_name, preferred_first, legal_first, legal_last)")
      .eq("relationship_status", "trusted")
      .range(0, 9999);
    if (linksError) throw linksError;
    studentsByPerson = (links || []).reduce((acc, l) => {
      if (!l.portal_students) return acc;
      (acc[l.person_id] = acc[l.person_id] || []).push({
        id: l.portal_students.id,
        name:
          [l.portal_students.preferred_first || l.portal_students.legal_first, l.portal_students.legal_last]
            .filter(Boolean)
            .join(" ") || l.portal_students.display_name,
        role: l.role || "",
        primary: Boolean(l.primary_contact)
      });
      return acc;
    }, {});
  }

  return (people || []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    firstName: p.first_name,
    lastName: p.last_name,
    personType: p.person_type,
    source: p.source,
    students: studentsByPerson[p.id] || [],
    contacts: (contactsByPerson[p.id] || []).map((c) => ({
      id: c.id,
      contactType: c.contact_type,
      valueDisplay: c.value_display,
      verificationStatus: c.verification_status,
      verificationSource: c.verification_source,
      source: c.source
    }))
  }));
}

function toCsv(people) {
  const header = ["person", "relationship_students", "method_type", "value", "source"];
  const rows = [];
  for (const p of people) {
    const studentNames = p.students.map((s) => s.name).join("; ");
    if (!p.contacts.length) {
      rows.push([p.displayName, studentNames, "", "", ""].map(csvCell).join(","));
      continue;
    }
    for (const c of p.contacts) {
      rows.push(
        [p.displayName, studentNames, c.contactType, c.valueDisplay, c.source].map(csvCell).join(",")
      );
    }
  }
  return [header.join(","), ...rows].join("\n");
}

// GET /api/admin/contacts
//   (no params)      -> full people+contacts list, JSON
//   ?export=csv       -> CSV download of the same data
//   ?personId=<id>     -> recent audit_log history for that person, JSON
export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const personId = text(params.get("personId"));
  const capability = text(params.get("export")) === "csv"
    ? STAFF_CAPABILITIES.CONTACTS_EXPORT
    : STAFF_CAPABILITIES.STUDENTS_READ;
  const authorization = await authorizeStaffRequest(req, capability);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  if (personId) {
    const { data: history, error } = await supabaseAdmin
      .from("audit_log")
      .select("id, occurred_at, actor_type, actor_name, action, table_name, record_id, changes, route")
      .eq("record_id", personId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit({
      actor: staffActor(staff),
      action: "view",
      table: "audit_log",
      recordId: personId,
      route: "/api/admin/contacts"
    });

    return NextResponse.json({ history: history || [] });
  }

  let people;
  try {
    people = await loadPeopleWithContacts();
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to load contacts" }, { status: 500 });
  }

  if (text(params.get("export")) === "csv") {
    await logAudit({
      actor: staffActor(staff),
      action: "export",
      table: "portal_contact_methods",
      route: "/api/admin/contacts"
    });
    const csv = toCsv(people);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ashley-bands-contacts-${stamp}.csv"`
      }
    });
  }

  await logAudit({
    actor: staffActor(staff),
    action: "contacts.list",
    table: "portal_people",
    route: "/api/admin/contacts"
  });

  return NextResponse.json({ people });
}

// PATCH -> edit one contact method's value.
// body: { personId, contactMethodId, value }
// Note: the person is the audit record_id (not the contact method id) so a
// person's full contact history — profile edits and contact-method edits
// alike — reads back as one timeline from a single record_id lookup.
export async function PATCH(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.STUDENTS_WRITE);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));
  const personId = text(body.personId);
  const contactMethodId = text(body.contactMethodId);
  const newValue = text(body.value);
  if (!personId || !contactMethodId || !newValue) {
    return NextResponse.json({ error: "Missing personId, contactMethodId, or value" }, { status: 400 });
  }

  const { data: current, error: loadError } = await supabaseAdmin
    .from("portal_contact_methods")
    .select("id, person_id, contact_type, value_display, value_normalized, source")
    .eq("id", contactMethodId)
    .maybeSingle();
  if (loadError || !current) return NextResponse.json({ error: "Contact method not found" }, { status: 404 });
  if (current.person_id !== personId) {
    return NextResponse.json({ error: "Contact method does not belong to that person" }, { status: 400 });
  }

  const valueNormalized =
    current.contact_type === "email" ? normalizeEmail(newValue) : normalizePhone(newValue);

  // portal_contact_methods.source carries no CHECK constraint (only
  // contact_type + verification_status do — see supabase/migrations/0006 +
  // 0030). Safe to write a new source value directly.
  const { error } = await supabaseAdmin
    .from("portal_contact_methods")
    .update({ value_display: newValue, value_normalized: valueNormalized, source: "staff-edit" })
    .eq("id", contactMethodId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "update",
    table: "portal_contact_methods",
    recordId: personId,
    route: "/api/admin/contacts",
    changes: {
      contact_method_id: contactMethodId,
      value_display: { old: current.value_display, new: newValue },
      source: { old: current.source, new: "staff-edit" }
    }
  });

  return NextResponse.json({ ok: true });
}
