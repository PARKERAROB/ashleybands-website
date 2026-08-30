import calendarData from "@/public/calendar-data.json";
import { loadProgramAttendanceWorkspace } from "@/lib/attendanceWorkspace";
import { loadCurrentStudents } from "@/lib/currentStudents";
import { loadFinancialOperations } from "@/lib/financialOperations";
import { loadFormOperations } from "@/lib/formOperations";
import { loadProgramMemberships } from "@/lib/programMemberships";
import { staffHasCapability, STAFF_CAPABILITIES } from "@/lib/staffCapabilities";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function contactReady(student) {
  return Boolean(student.schoolEmail && student.guardians.some((guardian) => guardian.emails.length && guardian.phones.length));
}

async function loadAssetSummary() {
  const [{ count: total, error: assetError }, { count: assigned, error: assignmentError }] = await Promise.all([
    supabaseAdmin.from("assets").select("id", { count: "exact", head: true }).eq("lifecycle_status", "active"),
    supabaseAdmin.from("asset_assignments").select("id", { count: "exact", head: true })
      .is("ends_at", null)
      .in("assignment_status", ["current", "provisional"]),
  ]);
  if (assetError || assignmentError) throw assetError || assignmentError;
  return { value: assigned || 0, unit: "assets assigned", total: total || 0 };
}

function upcomingCalendarCount() {
  const today = localDate();
  return (calendarData || []).filter((event) => String(event.end || event.start || "").slice(0, 10) >= today).length;
}

export async function loadOperationsSummary(staff) {
  const can = (capability) => staffHasCapability(staff, capability);
  const needStudents = can(STAFF_CAPABILITIES.STUDENTS_READ) || can(STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  const tasks = {};

  if (needStudents) tasks.students = loadCurrentStudents("active");
  if (can(STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ)) tasks.attendance = loadProgramAttendanceWorkspace();
  if (can(STAFF_CAPABILITIES.BILLING_READ)) tasks.financial = loadFinancialOperations();
  if (can(STAFF_CAPABILITIES.FORMS_STATUS_READ)) tasks.forms = loadFormOperations();
  if (can(STAFF_CAPABILITIES.ASSETS_READ)) tasks.assets = loadAssetSummary();
  if (can(STAFF_CAPABILITIES.MEMBERSHIPS_READ)) tasks.memberships = loadProgramMemberships();

  const names = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));
  const values = Object.fromEntries(names.map((name, index) => [name, settled[index]]));
  const metrics = {};
  const unavailable = [];

  const valueFor = (name) => {
    const result = values[name];
    if (!result) return null;
    if (result.status === "rejected") {
      unavailable.push(name);
      return null;
    }
    return result.value;
  };

  const students = valueFor("students");
  if (students && can(STAFF_CAPABILITIES.STUDENTS_READ)) {
    metrics.students = { value: students.counts.active, unit: "current students" };
  }
  if (students && can(STAFF_CAPABILITIES.COMMUNICATIONS_READ)) {
    metrics.communication = {
      value: students.students.filter((student) => !contactReady(student)).length,
      unit: "contact gaps",
    };
  }

  const attendance = valueFor("attendance");
  if (attendance) {
    metrics.attendance = {
      value: attendance.events.filter((event) => event.needsAction).length,
      unit: "sessions need action",
    };
    metrics.calendar = { value: upcomingCalendarCount(), unit: "upcoming dates" };
  }

  const financial = valueFor("financial");
  if (financial) {
    metrics.financial = {
      value: financial.roster.filter((student) => student.campaign.goalCents > 0 && student.campaign.raisedCents < 10_000).length,
      unit: "under $100",
    };
  }

  const forms = valueFor("forms");
  if (forms) {
    metrics.forms = { value: forms.summary.action + forms.summary.review, unit: "need form action" };
  }

  const assets = valueFor("assets");
  if (assets) metrics.assets = assets;

  const memberships = valueFor("memberships");
  if (memberships) {
    metrics.ensembles = { value: memberships.counts.groups, unit: "current groups" };
  }

  return {
    metrics,
    unavailable,
    generatedAt: new Date().toISOString(),
  };
}
