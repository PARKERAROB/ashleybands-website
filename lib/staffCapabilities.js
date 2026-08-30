export const ROLE_CAPABILITIES = Object.freeze({
  director: ["*"],
  sponsor_lead: ["sponsorship.read", "sponsorship.write"],
  program_staff: [
    "students.read",
    "students.write",
    "groups.read",
    "memberships.read",
    "memberships.write",
    "contacts.export",
    "attendance.events.read",
    "attendance.events.write",
    "attendance.exceptions.write",
    "attendance.staff.write",
    "attendance.school.read",
    "attendance.school.import",
    "assets.read",
    "assets.write",
    "assets.assign",
    "forms.status.read",
    "forms.manage",
    "funding.read",
  ],
});

export const STAFF_CAPABILITIES = Object.freeze({
  STUDENTS_READ: "students.read",
  STUDENTS_WRITE: "students.write",
  GROUPS_READ: "groups.read",
  MEMBERSHIPS_READ: "memberships.read",
  MEMBERSHIPS_WRITE: "memberships.write",
  CONTACTS_EXPORT: "contacts.export",
  COMMUNICATIONS_READ: "communications.read",
  COMMUNICATIONS_WRITE: "communications.write",
  COMMUNICATIONS_SEND: "communications.send",
  SYSTEM_DATA_INVENTORY_READ: "system.data_inventory.read",
  ATTENDANCE_EVENTS_READ: "attendance.events.read",
  ATTENDANCE_EVENTS_WRITE: "attendance.events.write",
  ATTENDANCE_EXCEPTIONS_WRITE: "attendance.exceptions.write",
  ATTENDANCE_STAFF_WRITE: "attendance.staff.write",
  ATTENDANCE_REPORT_SEND: "attendance.report.send",
  ATTENDANCE_SCHOOL_READ: "attendance.school.read",
  ATTENDANCE_SCHOOL_IMPORT: "attendance.school.import",
  ASSETS_READ: "assets.read",
  ASSETS_WRITE: "assets.write",
  ASSETS_ASSIGN: "assets.assign",
  FORMS_STATUS_READ: "forms.status.read",
  FORMS_MANAGE: "forms.manage",
  FORMS_SENSITIVE_READ: "forms.sensitive.read",
  FUNDING_READ: "funding.read",
  BILLING_READ: "billing.read",
  BILLING_WRITE: "billing.write",
  BILLING_EXPORT: "billing.export",
  SPONSORSHIP_READ: "sponsorship.read",
  SPONSORSHIP_WRITE: "sponsorship.write",
  SPONSORSHIP_GIFTS_WRITE: "sponsorship.gifts.write",
  SPONSORSHIP_OUTREACH_SEND: "sponsorship.outreach.send",
});

export function staffHasCapability(staff, capability) {
  const capabilities = ROLE_CAPABILITIES[String(staff?.role || "")] || [];
  const required = Array.isArray(capability) ? capability : [capability];
  return capabilities.includes("*") || required.every((item) => capabilities.includes(item));
}
