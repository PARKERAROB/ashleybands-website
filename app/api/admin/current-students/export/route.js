import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadCurrentStudents } from "@/lib/currentStudents";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { dropSuppressed, dropSuppressedFromStudents } from "@/lib/contactSuppression";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

function emailsFor(student, axis) {
  const studentEmails = [student.schoolEmail, student.personalEmail].filter(Boolean);
  const guardianEmails = student.guardians.flatMap((guardian) => guardian.emails || []);
  const values = axis === "student" ? studentEmails : axis === "guardian" ? guardianEmails : [...studentEmails, ...guardianEmails];
  return [...new Map(values.map((email) => [String(email).trim().toLowerCase(), String(email).trim()])).values()].filter(Boolean);
}

function csvCell(value) {
  const raw = String(value ?? "");
  const spreadsheetSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

function contactCsv(students) {
  const lines = [["Student", "Legal name", "Grade", "Ensembles", "Program instrument", "School email", "Personal email", "Student mobile", "Guardians", "Guardian emails", "Guardian phones"]];
  for (const student of students) {
    lines.push([
      student.displayName, student.legalName, student.grade, student.ensembles.join(" + "), student.programInstrument,
      student.schoolEmail, student.personalEmail, student.mobile,
      student.guardians.map((guardian) => guardian.name).join(" + "),
      student.guardians.flatMap((guardian) => guardian.emails).join(" + "),
      student.guardians.flatMap((guardian) => guardian.phones).join(" + "),
    ]);
  }
  return lines.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.CONTACTS_EXPORT);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.studentIds) ? body.studentIds : []).map(String).filter(Boolean))].slice(0, 500);
  const view = body.view === "inactive" ? "inactive" : "active";
  const format = body.format === "csv" ? "csv" : "emails";
  const axis = ["student", "guardian", "both"].includes(body.axis) ? body.axis : "both";
  if (!ids.length) return json({ error: "Select at least one student." }, 400);

  try {
    const roster = await loadCurrentStudents(view);
    const allowedIds = new Set(ids);
    const selected = roster.students.filter((student) => allowedIds.has(student.id));
    if (selected.length !== ids.length) return json({ error: "One or more selected students are not in this status view." }, 400);
    // #209: opted-out addresses never leave in a copy or CSV. Lookup failure fails the request.
    const filtered = format === "csv"
      ? await dropSuppressedFromStudents(selected, supabaseAdmin)
      : await dropSuppressed([...new Map(selected.flatMap((student) => emailsFor(student, axis)).map((email) => [email.toLowerCase(), email])).values()], supabaseAdmin);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: format === "csv" ? "export_contacts" : "copy_contact_emails",
      table: "portal_students,portal_student_people,portal_contact_methods,contact_suppressions",
      recordId: `${view}:${selected.length}`,
      route: "/api/admin/current-students/export",
      changes: { student_ids: selected.map((student) => student.id), axis, format, suppressed_count: filtered.suppressedCount },
    });
    if (format === "csv") return json({ csv: contactCsv(filtered.students), filename: `${view}-students.csv`, count: selected.length, suppressedCount: filtered.suppressedCount });
    return json({ emails: filtered.kept, count: filtered.kept.length, suppressedCount: filtered.suppressedCount });
  } catch (error) {
    console.error("[current-students-export] failed:", error?.message || error);
    return json({ error: "The contact action could not be recorded and was not completed." }, 503);
  }
}
