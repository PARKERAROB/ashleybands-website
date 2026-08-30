import { validateStaffRequest } from "@/lib/staffAuth";

const ROLE_CAPABILITIES = Object.freeze({
  director: ["*"],
  sponsor_lead: ["sponsorship.read", "sponsorship.write"],
});

export function staffHasCapability(staff, capability) {
  const capabilities = ROLE_CAPABILITIES[String(staff?.role || "")] || [];
  return capabilities.includes("*") || capabilities.includes(capability);
}

export async function authorizeStaffRequest(request, capability) {
  const staff = await validateStaffRequest(request);
  if (!staff) return { ok: false, status: 401, error: "Not signed in" };
  if (!staffHasCapability(staff, capability)) {
    return { ok: false, status: 403, error: "This staff account does not have access to student records." };
  }
  return { ok: true, staff };
}

export const STAFF_CAPABILITIES = Object.freeze({
  STUDENTS_READ: "students.read",
  STUDENTS_WRITE: "students.write",
  GROUPS_READ: "groups.read",
  MEMBERSHIPS_READ: "memberships.read",
  MEMBERSHIPS_WRITE: "memberships.write",
  CONTACTS_EXPORT: "contacts.export",
  ATTENDANCE_EVENTS_READ: "attendance.events.read",
  ATTENDANCE_EVENTS_WRITE: "attendance.events.write",
  ATTENDANCE_EXCEPTIONS_WRITE: "attendance.exceptions.write",
  ATTENDANCE_STAFF_WRITE: "attendance.staff.write",
  ATTENDANCE_REPORT_SEND: "attendance.report.send",
  ATTENDANCE_SCHOOL_READ: "attendance.school.read",
  ATTENDANCE_SCHOOL_IMPORT: "attendance.school.import",
  SPONSORSHIP_READ: "sponsorship.read",
  SPONSORSHIP_WRITE: "sponsorship.write",
});
