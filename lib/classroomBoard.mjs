// Band room board (#154). Pure helpers so the block choice is testable without a browser.
// Block times: Workdesk context/entities/school-day.md (bell schedule dated 8/20/2026).

export const TIME_ZONE = "America/New_York";

export const CLASS_BLOCKS = [
  { id: "concert", block: "1st block", name: "Concert Band", start: "08:30", end: "10:03" },
  { id: "percussion", block: "2nd block", name: "Percussion Ensemble", start: "10:09", end: "11:42" },
  { id: "wind", block: "4th block", name: "Wind Ensemble", start: "13:57", end: "15:30" }
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Wall-clock parts in the school's time zone.
export function schoolClock(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    weekdayIndex: WEEKDAYS.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

// The class to show: the block in session, else the next one today.
// Weekends, before school and after 4th block show 1st block.
export function selectBlock(date) {
  const { weekdayIndex, minutes: now } = schoolClock(date);
  if (weekdayIndex < 1 || weekdayIndex > 5) return CLASS_BLOCKS[0].id;
  const next = CLASS_BLOCKS.find((block) => now < minutes(block.end));
  return (next || CLASS_BLOCKS[0]).id;
}

// First dated item on or after today, by ISO date string.
export function nextOnOrAfter(items, isoDate) {
  return [...(items || [])].filter((item) => item.date >= isoDate).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function shortDate(isoDate) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${isoDate}T12:00:00Z`)
  );
}
