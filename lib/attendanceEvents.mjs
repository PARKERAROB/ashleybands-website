export const ATTENDANCE_TIME_ZONE = "America/New_York";

// Website-owned attendance configuration. Calendar event identity remains canonical
// in BandsofAHS; adding another marching series is intentionally a one-line change.
export const ATTENDANCE_ENABLED_EVENT_IDS = new Set(["evt-0007", "evt-0008"]);

function localDateFromStart(start) {
  const match = String(start || "").match(/^(\d{4}-\d{2}-\d{2})T/);
  if (!match) throw new Error("Attendance occurrences require a local calendar start time.");
  return match[1];
}

export function buildOccurrenceKey(event) {
  const eventId = String(event?.id || "").trim();
  if (!eventId) throw new Error("Attendance occurrences require a calendar event id.");
  return `${eventId}:${localDateFromStart(event.start)}`;
}

export function localDateAt(date, timeZone = ATTENDANCE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localEventTimeToIso(localDate, localTime, timeZone = ATTENDANCE_TIME_ZONE) {
  const match = `${localDate}T${localTime}`.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );
  if (!match) throw new Error("Use a valid event-local time.");
  const desired = match.slice(1).map(Number);
  const desiredAsUtc = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4]);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  let instant = desiredAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value])
    );
    const observedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    const difference = desiredAsUtc - observedAsUtc;
    instant += difference;
    if (!difference) break;
  }
  return new Date(instant).toISOString();
}

export function configuredAttendanceOccurrences(calendarEvents) {
  return calendarEvents
    .filter((event) => ATTENDANCE_ENABLED_EVENT_IDS.has(event.id) && !event.all_day)
    .map((event) => {
      const localDate = localDateFromStart(event.start);
      const endDate = event.end ? localDateFromStart(event.end) : null;
      return {
        occurrenceKey: buildOccurrenceKey(event),
        calendarEventId: event.id,
        title: event.title,
        localDate,
        localStart: event.start,
        localEnd: event.end || null,
        startsAt: localEventTimeToIso(localDate, event.start.slice(11, 16)),
        endsAt: event.end ? localEventTimeToIso(endDate, event.end.slice(11, 16)) : null,
        source: "calendar_projection"
      };
    })
    .sort((a, b) => a.localStart.localeCompare(b.localStart)
      || a.occurrenceKey.localeCompare(b.occurrenceKey));
}

export function selectAttendanceOccurrence(occurrences, {
  occurrenceKey,
  now = new Date(),
  timeZone = ATTENDANCE_TIME_ZONE
} = {}) {
  if (!occurrences.length) throw new Error("No attendance-enabled events are configured.");
  if (occurrenceKey) {
    const selected = occurrences.find((event) => event.occurrenceKey === occurrenceKey);
    if (!selected) throw new Error("Attendance event not found.");
    return selected;
  }

  const today = localDateAt(now, timeZone);
  const todayOccurrences = occurrences.filter((event) => event.localDate === today);
  return todayOccurrences.find((event) => new Date(event.endsAt || event.startsAt) >= now)
    || todayOccurrences.at(-1)
    || occurrences.find((event) => event.localDate > today)
    || occurrences.at(-1);
}

export function canManageAttendanceExceptions(session) {
  return session?.access === "staff";
}

export function buildStudentAttendance(student, observation, exceptions = []) {
  return {
    ...student,
    status: observation?.status || null,
    note: observation?.note || "",
    arrivedAt: observation?.arrived_at || null,
    departedAt: observation?.departed_at || null,
    updatedAt: observation?.updated_at || null,
    exceptions: exceptions.filter((item) => item.approval_state === "approved")
  };
}

function formatLocalTime(iso, timeZone = ATTENDANCE_TIME_ZONE) {
  if (!iso) return "time not specified";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

const EXCEPTION_LABELS = {
  absent: "APPROVED ABSENCE",
  late_arrival: "APPROVED LATE ARRIVAL",
  early_departure: "APPROVED EARLY DEPARTURE"
};

export function buildAttendanceReport(sheet) {
  const absentCount = sheet.students.filter((student) => student.status === "absent").length;
  const tardyCount = sheet.students.filter((student) => student.status === "tardy").length;
  const noteCount = sheet.students.filter((student) => String(student.note || "").trim()).length;
  const departedCount = sheet.students.filter((student) => student.departedAt).length;
  const exceptionCount = sheet.exceptions.length;
  const details = [];

  for (const student of sheet.students) {
    const placement = `${student.section || "Unassigned"}, Grade ${student.grade || "—"}`;
    if (student.status === "absent") details.push(`ABSENT: ${student.name} | ${placement}`);
    if (student.status === "tardy") details.push(`TARDY: ${student.name} | ${placement}`);
    if (String(student.note || "").trim()) {
      details.push(`NOTE: ${student.name}: ${String(student.note).trim()}`);
    }
    if (student.departedAt) {
      details.push(`ACTUAL DEPARTURE: ${student.name} | ${formatLocalTime(student.departedAt)}`);
    }
  }
  for (const exception of sheet.exceptions) {
    const time = exception.expected_at ? ` | ${formatLocalTime(exception.expected_at)}` : "";
    const note = String(exception.note || "").trim() ? ` | ${String(exception.note).trim()}` : "";
    details.push(`${EXCEPTION_LABELS[exception.kind]}: ${exception.studentName}${time}${note}`);
  }

  return {
    absentCount,
    tardyCount,
    noteCount,
    departedCount,
    exceptionCount,
    details
  };
}
