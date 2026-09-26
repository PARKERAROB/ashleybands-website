// Pure date logic for /this-week, the home "This week" strip, the assistant's
// calendar context, and /calendar deep links (#134). No I/O, no Date.now() defaults
// hidden in helpers: callers pass `now` so tests can pin it.
//
// public/calendar-data.json times are floating wall-clock times in the band's
// timezone ("2026-10-03T08:00"), dates are "YYYY-MM-DD", and an all-day `end`
// is the inclusive last day (same reading as app/calendar/CalendarView.jsx).

export const BAND_TIMEZONE = "America/New_York";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const datePart = (value) => String(value || "").slice(0, 10);
const hasTime = (value) => String(value || "").includes("T");

function timePart(value) {
  const [h, m] = String(value).split("T")[1].split(":").map(Number);
  return { h, m: m || 0 };
}

function isMidnight(value) {
  if (!hasTime(value)) return false;
  const { h, m } = timePart(value);
  return h === 0 && m === 0;
}

// Today's date and minutes past midnight in the band's timezone.
export function zonedNow(now, timeZone = BAND_TIMEZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function weekday(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function longDate(ymd) {
  const [, m, d] = ymd.split("-").map(Number);
  return `${WEEKDAYS[weekday(ymd)]}, ${MONTHS[m - 1]} ${d}`;
}

export function dayLabel(ymd, today) {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  return longDate(ymd);
}

export function clockLabel(value) {
  const { h, m } = timePart(value);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

// True when a timed event has no real end: it runs to midnight (the calendar's
// "until the host posts a schedule" convention, e.g. competitions 8am to 00:00).
function endsAtMidnight(ev) {
  if (!hasTime(ev.start) || !isMidnight(ev.end)) return false;
  const end = datePart(ev.end);
  const start = datePart(ev.start);
  return end === start || end === addDays(start, 1);
}

export function isAllDay(ev) {
  return Boolean(ev.all_day) || !hasTime(ev.start);
}

// "All day", "Starts 8am", "4pm – 7pm", or "7pm".
export function timeText(ev) {
  if (isAllDay(ev)) return "All day";
  const start = clockLabel(ev.start);
  if (!ev.end || !hasTime(ev.end)) return start;
  if (endsAtMidnight(ev)) return `Starts ${start}`;
  if (datePart(ev.end) !== datePart(ev.start)) {
    const [, m, d] = datePart(ev.end).split("-").map(Number);
    return `${start} – ${MONTHS[m - 1]} ${d}, ${clockLabel(ev.end)}`;
  }
  return `${start} – ${clockLabel(ev.end)}`;
}

// Days an event appears on. Multi-day all-day events cover each day through `end`.
// A timed event that ends at midnight belongs only to its start day.
export function eventDates(ev) {
  const start = datePart(ev.start);
  if (!isAllDay(ev) || !ev.end) return [start];
  const end = datePart(ev.end);
  const out = [];
  for (let d = start; d <= end && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}

// Minutes past midnight after which a timed event on `today` has finished.
function finishedBy(ev) {
  if (isAllDay(ev)) return Infinity;
  if (endsAtMidnight(ev)) return 24 * 60;
  if (ev.end && hasTime(ev.end) && datePart(ev.end) === datePart(ev.start)) {
    const { h, m } = timePart(ev.end);
    return h * 60 + m;
  }
  if (ev.end && hasTime(ev.end)) return Infinity; // ends on a later day
  const { h, m } = timePart(ev.start);
  return h * 60 + m + 60; // no end given: keep it listed for its first hour
}

// Stable deep-link key. Event ids repeat for recurring rehearsals, so the date is part of it.
export function eventAnchor(ev) {
  return `${ev.id}-${datePart(ev.start)}`;
}

export function eventHref(ev) {
  return `/calendar#${eventAnchor(ev)}`;
}

// Reads "#evt-0108-2026-09-29" (id + start date) or "#evt-0108" (id only).
export function parseEventAnchor(hash) {
  const raw = decodeURIComponent(String(hash || "").replace(/^#/, "")).trim();
  if (!raw) return null;
  const match = raw.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);
  return match ? { id: match[1], date: match[2] } : { id: raw, date: null };
}

// The event a deep link names. With only an id, prefer the next upcoming occurrence.
export function findAnchoredEvent(events, hash, today) {
  const target = parseEventAnchor(hash);
  if (!target) return null;
  const same = (events || []).filter((ev) => ev.id === target.id);
  if (!same.length) return null;
  if (target.date) return same.find((ev) => datePart(ev.start) === target.date) || null;
  return same.find((ev) => eventDates(ev).at(-1) >= today) || same[0];
}

// "This week" runs seven days from today, stretched to Sunday when it would end on a Friday or
// Saturday, so the coming weekend's rehearsals and games are always included.
export function weekWindowDays(now, timeZone = BAND_TIMEZONE) {
  const { date: today } = zonedNow(now, timeZone);
  const lastDay = weekday(addDays(today, 6));
  return 7 + (lastDay === 5 ? 2 : lastDay === 6 ? 1 : 0);
}

// Upcoming events grouped by day for the `days` days starting today (band timezone).
// Timed events that have already finished today are dropped.
export function upcomingByDay(events, now, { days = 7, timeZone = BAND_TIMEZONE } = {}) {
  const { date: today, minutes } = zonedNow(now, timeZone);
  const last = addDays(today, days - 1);
  const buckets = new Map();
  for (const ev of events || []) {
    if (!ev || !ev.start || !ev.title) continue;
    for (const date of eventDates(ev)) {
      if (date < today || date > last) continue;
      if (date === today && date === datePart(ev.start) && finishedBy(ev) <= minutes) continue;
      if (!buckets.has(date)) buckets.set(date, []);
      buckets.get(date).push(ev);
    }
  }
  return [...buckets.keys()].sort().map((date) => ({
    date,
    label: dayLabel(date, today),
    events: buckets.get(date)
      .sort((a, b) => Number(!isAllDay(a)) - Number(!isAllDay(b)) || String(a.start).localeCompare(String(b.start)))
      .map((ev) => ({ ...ev, anchor: eventAnchor(ev), href: eventHref(ev), time: timeText(ev) }))
  }));
}

// Flat list, one entry per event occurrence, for compact views.
export function upcomingList(events, now, { days = 7, limit = Infinity, timeZone = BAND_TIMEZONE } = {}) {
  const seen = new Set();
  const out = [];
  for (const day of upcomingByDay(events, now, { days, timeZone })) {
    for (const ev of day.events) {
      if (seen.has(ev.anchor)) continue;
      seen.add(ev.anchor);
      out.push({ ...ev, dayLabel: day.label, date: day.date });
    }
  }
  return out.slice(0, limit);
}

// Plain-text schedule for the Band Assistant's context.
export function calendarContextText(events, now, { days = 30, timeZone = BAND_TIMEZONE } = {}) {
  const { date: today } = zonedNow(now, timeZone);
  const header = `UPCOMING BAND CALENDAR (next ${days} days from ${longDate(today)}, ${today.slice(0, 4)}; source: ashleybands.com/calendar)`;
  const items = upcomingList(events, now, { days, timeZone });
  if (!items.length) return `${header}\nNothing is on the band calendar in the next ${days} days.`;
  return [header, ...items.map((ev) => {
    const bits = [`${longDate(ev.date)}: ${ev.title}`, ev.time];
    if (ev.location) bits.push(ev.location);
    return `- ${bits.join(", ")}${ev.description ? `. ${ev.description}` : ""}`;
  })].join("\n");
}
