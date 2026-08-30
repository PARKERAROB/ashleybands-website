import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson } from "@/lib/privateResponse";

export const runtime = "nodejs";

function text(v) {
  return String(v || "").trim();
}
function buildDisplayName({ preferredFirst, legalFirst, legalLast }) {
  return [text(preferredFirst) || text(legalFirst), text(legalLast)].filter(Boolean).join(" ").trim();
}

// GET ?q=  -> search students (with guardians). No q -> recent/first 50.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const url = new URL(req.url);
  const q = text(url.searchParams.get("q")).toLowerCase();
  const requestedStatus = text(url.searchParams.get("status")) || "active";
  const allowedStatuses = new Set(["active", "inactive", "inactive-graduated", "all"]);
  if (!allowedStatuses.has(requestedStatus)) {
    return privateJson({ error: "Invalid student status." }, 400);
  }

  let query = supabaseAdmin
    .from("portal_students")
    .select("id, source_student_id, legal_first, legal_last, preferred_first, display_name, grade_fall26, school_email, cell_phone, status, source")
    .order("legal_last", { ascending: true })
    .limit(50);
  if (requestedStatus === "inactive") {
    query = query.in("status", ["inactive", "inactive-dropped", "inactive-moved"]);
  } else if (requestedStatus !== "all") {
    query = query.eq("status", requestedStatus);
  }
  if (q) query = query.or(`display_name.ilike.%${q}%,legal_last.ilike.%${q}%,school_email.ilike.%${q}%`);

  const { data: students, error } = await query;
  if (error) return privateJson({ error: "Student records could not be loaded." }, 500);

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
  try {
    await logAuditRequired({
    actor: staffActor(staff),
    action: "view",
    table: "portal_students",
    recordId: q ? `search:${q}` : null,
    route: "/api/admin/students"
    });
  } catch {
    return privateJson({ error: "This sensitive read could not be durably attributed." }, 503);
  }

  return privateJson({ students: result });
}

// POST -> create a student. body: legalFirst, legalLast, preferredFirst?, gradeFall26?, schoolEmail?, cellPhone?, status?
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.STUDENTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));
  const legalFirst = text(body.legalFirst);
  const legalLast = text(body.legalLast);
  if (!legalFirst || !legalLast) {
    return privateJson({ error: "First and last name are required." }, 400);
  }
  const schoolEmail = text(body.schoolEmail).toLowerCase();
  if (body.status != null && text(body.status) !== "active") {
    return privateJson({ error: "Create the current student as active, then record any status transition with a reason." }, 400);
  }
  // Match roster convention: school email is the source_student_id when present.
  const sourceStudentId = schoolEmail || `${legalFirst}${legalLast}`.toLowerCase().replace(/[^a-z0-9]/g, "") + `-manual-${Date.now().toString(36)}`;

  const { data: existing } = await supabaseAdmin
    .from("portal_students")
    .select("id")
    .eq("source_student_id", sourceStudentId)
    .maybeSingle();
  if (existing) {
    return privateJson({ error: "A student with this email already exists." }, 409);
  }

  try {
    await logAuditRequired({
      actor: staffActor(staff), action: "insert_requested", table: "portal_students",
      recordId: sourceStudentId, route: "/api/admin/students",
      changes: { legal_first: { old: null, new: legalFirst }, legal_last: { old: null, new: legalLast }, school_email: { old: null, new: schoolEmail || null } },
    });
  } catch {
    return privateJson({ error: "The student was not created because the action could not be durably attributed." }, 503);
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
      status: "active",
      source: "manual",
      notes: text(body.notes) || `Added via admin by ${staff.display_name}`
    })
    .select("id")
    .single();

  if (error) return privateJson({ error: "The student could not be created." }, 500);

  return privateJson({ id: data.id });
}

// PATCH -> update a student. body: id + any of the editable fields.
export async function PATCH(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.STUDENTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));
  const id = text(body.id);
  if (!id) return privateJson({ error: "Missing id" }, 400);

  const update = {};
  if (body.legalFirst != null) {
    update.legal_first = text(body.legalFirst);
    if (!update.legal_first) return privateJson({ error: "Legal first name is required." }, 400);
  }
  if (body.legalLast != null) {
    update.legal_last = text(body.legalLast);
    if (!update.legal_last) return privateJson({ error: "Legal last name is required." }, 400);
  }
  if (body.preferredFirst != null) update.preferred_first = text(body.preferredFirst) || null;
  if (body.gradeFall26 != null) update.grade_fall26 = text(body.gradeFall26) || null;
  if (body.schoolEmail != null) update.school_email = text(body.schoolEmail).toLowerCase() || null;
  if (body.cellPhone != null) update.cell_phone = text(body.cellPhone) || null;
  const nextStatus = body.status != null ? text(body.status) : null;
  if (nextStatus && !["active", "inactive", "inactive-graduated"].includes(nextStatus)) {
    return privateJson({ error: "Invalid student status." }, 400);
  }
  const statusReason = text(body.statusReason);

  const { error } = await supabaseAdmin.rpc("update_student_profile_and_status_with_audit", {
    p_student_id: id,
    p_profile: update,
    p_to_status: nextStatus,
    p_reason: statusReason || null,
    p_actor_staff_id: staff.id,
    p_route: "/api/admin/students",
  });
  if (error) {
    console.error("[student-profile-update]", error.message);
    return privateJson({ error: "The student changes were not saved." }, 400);
  }

  return privateJson({ ok: true });
}
