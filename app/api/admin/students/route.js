import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

function text(v) {
  return String(v || "").trim();
}
function buildDisplayName({ preferredFirst, legalFirst, legalLast }) {
  return [text(preferredFirst) || text(legalFirst), text(legalLast)].filter(Boolean).join(" ").trim();
}

// GET ?q=  -> search students (with guardians). No q -> recent/first 50.
export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const q = text(new URL(req.url).searchParams.get("q")).toLowerCase();

  let query = supabaseAdmin
    .from("portal_students")
    .select("id, source_student_id, legal_first, legal_last, preferred_first, display_name, grade_fall26, school_email, cell_phone, status, source")
    .order("legal_last", { ascending: true })
    .limit(50);
  if (q) query = query.or(`display_name.ilike.%${q}%,legal_last.ilike.%${q}%,school_email.ilike.%${q}%`);

  const { data: students, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach guardians (trusted links + contacts) for the returned students.
  const ids = (students || []).map((s) => s.id);

  // Touched-by-family indicator (view is live-derived, see 0028 migration).
  // Best-effort: a missing/broken view must never break the roster search.
  let touchByStudent = {};
  if (ids.length) {
    const { data: touch, error: touchError } = await supabaseAdmin
      .from("portal_student_family_touch")
      .select("student_id, touched_by_family, last_touch_at")
      .in("student_id", ids);
    if (touchError) {
      console.warn("[admin/students] touch-signal lookup failed:", touchError.message);
    } else {
      touchByStudent = (touch || []).reduce((acc, t) => {
        acc[t.student_id] = { touchedByFamily: t.touched_by_family, lastTouchAt: t.last_touch_at };
        return acc;
      }, {});
    }
  }

  let guardiansByStudent = {};
  if (ids.length) {
    const { data: links } = await supabaseAdmin
      .from("portal_student_people")
      .select("student_id, role, primary_contact, relationship_status, portal_people(id, display_name, person_type)")
      .in("student_id", ids)
      .eq("relationship_status", "trusted");
    const guardianLinks = (links || []).filter((l) => l.portal_people && l.portal_people.person_type !== "student");
    const personIds = [...new Set(guardianLinks.map((l) => l.portal_people.id))];
    let contactsByPerson = {};
    if (personIds.length) {
      const { data: contacts } = await supabaseAdmin
        .from("portal_contact_methods")
        .select("person_id, contact_type, value_display")
        .in("person_id", personIds);
      contactsByPerson = (contacts || []).reduce((acc, c) => {
        (acc[c.person_id] = acc[c.person_id] || []).push(c);
        return acc;
      }, {});
    }
    guardiansByStudent = guardianLinks.reduce((acc, l) => {
      const pid = l.portal_people.id;
      const contacts = contactsByPerson[pid] || [];
      (acc[l.student_id] = acc[l.student_id] || []).push({
        id: pid,
        name: l.portal_people.display_name,
        role: l.role || "",
        primary: Boolean(l.primary_contact),
        emails: contacts.filter((c) => c.contact_type === "email").map((c) => c.value_display),
        phones: contacts.filter((c) => c.contact_type === "phone").map((c) => c.value_display)
      });
      return acc;
    }, {});
  }

  const result = (students || []).map((s) => ({
    ...s,
    guardians: guardiansByStudent[s.id] || [],
    touchedByFamily: touchByStudent[s.id]?.touchedByFamily ?? false,
    lastTouchAt: touchByStudent[s.id]?.lastTouchAt ?? null
  }));

  // Page-level read log (not per-query): one entry per admin view of student
  // PII (roster/search + embedded guardian contacts).
  await logAudit({
    actor: staffActor(staff),
    action: "view",
    table: "portal_students",
    recordId: q ? `search:${q}` : null,
    route: "/api/admin/students"
  });

  return NextResponse.json({ students: result });
}

// POST -> create a student. body: legalFirst, legalLast, preferredFirst?, gradeFall26?, schoolEmail?, cellPhone?, status?
export async function POST(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const legalFirst = text(body.legalFirst);
  const legalLast = text(body.legalLast);
  if (!legalFirst || !legalLast) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }
  const schoolEmail = text(body.schoolEmail).toLowerCase();
  // Match roster convention: school email is the source_student_id when present.
  const sourceStudentId = schoolEmail || `${legalFirst}${legalLast}`.toLowerCase().replace(/[^a-z0-9]/g, "") + `-manual-${Date.now().toString(36)}`;

  const { data: existing } = await supabaseAdmin
    .from("portal_students")
    .select("id")
    .eq("source_student_id", sourceStudentId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "A student with this email already exists." }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("portal_students")
    .insert({
      source_student_id: sourceStudentId,
      legal_first: legalFirst,
      legal_last: legalLast,
      preferred_first: text(body.preferredFirst) || null,
      display_name: buildDisplayName({ preferredFirst: body.preferredFirst, legalFirst, legalLast }),
      grade_fall26: text(body.gradeFall26) || null,
      school_email: schoolEmail || null,
      cell_phone: text(body.cellPhone) || null,
      status: text(body.status) || "active",
      source: "manual",
      notes: text(body.notes) || `Added via admin by ${staff.display_name}`
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "insert",
    table: "portal_students",
    recordId: data.id,
    route: "/api/admin/students",
    changes: {
      legal_first: { old: null, new: legalFirst },
      legal_last: { old: null, new: legalLast },
      school_email: { old: null, new: schoolEmail || null }
    }
  });

  return NextResponse.json({ id: data.id });
}

// PATCH -> update a student. body: id + any of the editable fields.
export async function PATCH(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = text(body.id);
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: current, error: loadError } = await supabaseAdmin
    .from("portal_students")
    .select("legal_first, legal_last, preferred_first, grade_fall26, school_email, cell_phone, status, display_name")
    .eq("id", id)
    .maybeSingle();
  if (loadError || !current) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const update = {};
  if (body.legalFirst != null) update.legal_first = text(body.legalFirst);
  if (body.legalLast != null) update.legal_last = text(body.legalLast);
  if (body.preferredFirst != null) update.preferred_first = text(body.preferredFirst) || null;
  if (body.gradeFall26 != null) update.grade_fall26 = text(body.gradeFall26) || null;
  if (body.schoolEmail != null) update.school_email = text(body.schoolEmail).toLowerCase() || null;
  if (body.cellPhone != null) update.cell_phone = text(body.cellPhone) || null;
  if (body.status != null) update.status = text(body.status) || null;

  // Recompute display_name from the resulting name fields.
  update.display_name = buildDisplayName({
    preferredFirst: update.preferred_first !== undefined ? update.preferred_first : current.preferred_first,
    legalFirst: update.legal_first !== undefined ? update.legal_first : current.legal_first,
    legalLast: update.legal_last !== undefined ? update.legal_last : current.legal_last
  });

  const { error } = await supabaseAdmin.from("portal_students").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changes = {};
  for (const field of Object.keys(update)) {
    const oldValue = current[field] ?? null;
    const newValue = update[field] ?? null;
    if (oldValue !== newValue) changes[field] = { old: oldValue, new: newValue };
  }
  if (Object.keys(changes).length) {
    await logAudit({
      actor: staffActor(staff),
      action: "update",
      table: "portal_students",
      recordId: id,
      route: "/api/admin/students",
      changes
    });
  }

  return NextResponse.json({ ok: true });
}
