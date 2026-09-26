import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarContextText,
  findAnchoredEvent,
  parseEventAnchor,
  timeText,
  upcomingByDay,
  upcomingList,
  weekWindowDays,
  zonedNow
} from "../lib/thisWeek.mjs";

// Fixed "now": Saturday, September 26, 2026, 9:00am in Wilmington (13:00 UTC, EDT).
const NOW = Date.parse("2026-09-26T13:00:00Z");

const ev = (id, start, end, extra = {}) => ({
  id, title: `Event ${id}`, start, end, all_day: !String(start).includes("T"), category: "MB", location: "", description: null, ...extra
});

const EVENTS = [
  ev("evt-past", "2026-09-25T16:00", "2026-09-25T19:00"),
  ev("evt-sale", "2026-09-26T10:00", "2026-09-26T16:00", { location: "Ashley full-size gym", description: "Public sale." }),
  ev("evt-early", "2026-09-26T07:00", "2026-09-26T08:30"),
  ev("evt-reh", "2026-09-29T16:00", "2026-09-29T19:00", { location: "AHS" }),
  ev("evt-reh", "2026-10-01T16:00", "2026-10-01T19:00", { location: "AHS" }),
  ev("evt-sat", "2026-10-02T08:00", "2026-10-02T20:00"),
  ev("evt-day", "2026-09-28", null),
  ev("evt-late", "2026-10-02T08:00", "2026-10-03T00:00"),
  ev("evt-next", "2026-10-03T08:00", "2026-10-04T00:00"),
  ev("evt-out", "2026-10-04T09:00", "2026-10-04T10:00")
];

test("groups the next 7 days by day with Today and Tomorrow labels", () => {
  const days = upcomingByDay(EVENTS, NOW);
  assert.deepEqual(days.map((d) => d.label), [
    "Today", "Monday, September 28", "Tuesday, September 29", "Thursday, October 1", "Friday, October 2"
  ]);
  assert.equal(days[0].date, "2026-09-26");
  // Finished earlier today (7:00 to 8:30am) drops; the 10am sale stays.
  assert.deepEqual(days[0].events.map((e) => e.id), ["evt-sale"]);
  // Yesterday and October 3 (day 8) are outside the window.
  const ids = days.flatMap((d) => d.events.map((e) => e.id));
  assert(!ids.includes("evt-past"));
  assert(!ids.includes("evt-next"));
  assert(!ids.includes("evt-out"));
  const tomorrowRun = upcomingByDay(EVENTS, Date.parse("2026-09-27T13:00:00Z"));
  assert.equal(tomorrowRun[0].label, "Tomorrow");
  assert.equal(tomorrowRun[0].date, "2026-09-28");
});

test("time text: range, all day, and midnight end", () => {
  assert.equal(timeText(ev("a", "2026-09-29T16:00", "2026-09-29T19:00")), "4pm – 7pm");
  assert.equal(timeText(ev("b", "2026-09-29T16:30", "2026-09-29T19:15")), "4:30pm – 7:15pm");
  assert.equal(timeText(ev("c", "2026-09-28", null)), "All day");
  assert.equal(timeText({ ...ev("c2", "2026-05-15", "2026-05-16"), all_day: true }), "All day");
  // An end at midnight never shows as "12am".
  assert.equal(timeText(ev("d", "2026-10-10T08:00", "2026-10-11T00:00")), "Starts 8am");
  assert.equal(timeText(ev("e", "2026-10-10T08:00", "2026-10-10T00:00")), "Starts 8am");
  assert.equal(timeText(ev("f", "2026-10-10T19:00", null)), "7pm");
  for (const text of ["4pm – 7pm", "Starts 8am"]) assert(!text.includes("12am"));
});

test("midnight-ending events stay on their start day only", () => {
  const days = upcomingByDay([ev("evt-comp", "2026-10-03T08:00", "2026-10-04T00:00")], Date.parse("2026-09-28T13:00:00Z"));
  assert.equal(days.length, 1);
  assert.equal(days[0].date, "2026-10-03");
  assert.equal(days[0].events[0].time, "Starts 8am");
  // Still listed late on its own day.
  const lateSameDay = upcomingByDay([ev("evt-comp", "2026-10-03T08:00", "2026-10-04T00:00")], Date.parse("2026-10-04T03:30:00Z"));
  assert.equal(lateSameDay[0]?.label, "Today");
});

test("multi-day all-day events appear on each covered day, all-day first", () => {
  const trip = { ...ev("evt-trip", "2026-09-27", "2026-09-29"), all_day: true };
  const days = upcomingByDay([trip, ev("evt-reh", "2026-09-29T16:00", "2026-09-29T19:00")], NOW);
  assert.deepEqual(days.map((d) => d.date), ["2026-09-27", "2026-09-28", "2026-09-29"]);
  assert.deepEqual(days[2].events.map((e) => e.id), ["evt-trip", "evt-reh"]);
  assert.equal(days[0].events[0].time, "All day");
  // The compact list shows the trip once.
  assert.deepEqual(upcomingList([trip], NOW).map((e) => e.id), ["evt-trip"]);
});

test("today follows America/New_York, not UTC", () => {
  // 11:30pm Saturday in Wilmington is already Sunday in UTC.
  const lateSat = Date.parse("2026-09-27T03:30:00Z");
  assert.deepEqual(zonedNow(lateSat), { date: "2026-09-26", minutes: 23 * 60 + 30 });
  const window = upcomingByDay([ev("x", "2026-10-02T18:00", "2026-10-02T19:00"), ev("y", "2026-10-03T18:00", "2026-10-03T19:00")], lateSat);
  assert.deepEqual(window.map((d) => d.date), ["2026-10-02"]);
  // 12:30am Sunday local.
  assert.equal(zonedNow(Date.parse("2026-09-27T04:30:00Z")).date, "2026-09-27");
  // Standard time after the November change: 04:30Z is 11:30pm the day before.
  assert.equal(zonedNow(Date.parse("2026-11-10T04:30:00Z")).date, "2026-11-09");
});

test("empty week returns no days and a clear assistant line", () => {
  assert.deepEqual(upcomingByDay([], NOW), []);
  assert.deepEqual(upcomingByDay([ev("far", "2026-12-01T10:00", "2026-12-01T11:00")], NOW), []);
  assert.match(calendarContextText([], NOW), /Nothing is on the band calendar in the next 30 days\./);
});

test("compact list honors the limit and dedupes", () => {
  const list = upcomingList(EVENTS, NOW, { limit: 4 });
  assert.equal(list.length, 4);
  assert.deepEqual(list.map((e) => e.anchor), [
    "evt-sale-2026-09-26", "evt-day-2026-09-28", "evt-reh-2026-09-29", "evt-reh-2026-10-01"
  ]);
  assert.equal(list[0].href, "/calendar#evt-sale-2026-09-26");
});

test("calendar deep links name one occurrence of a repeating id", () => {
  assert.deepEqual(parseEventAnchor("#evt-0108-2026-09-29"), { id: "evt-0108", date: "2026-09-29" });
  assert.deepEqual(parseEventAnchor("#evt-0108"), { id: "evt-0108", date: null });
  assert.equal(parseEventAnchor(""), null);
  assert.equal(findAnchoredEvent(EVENTS, "#evt-reh-2026-10-01", "2026-09-26").start, "2026-10-01T16:00");
  assert.equal(findAnchoredEvent(EVENTS, "#evt-reh", "2026-09-30").start, "2026-10-01T16:00");
  assert.equal(findAnchoredEvent(EVENTS, "#evt-reh-2027-01-01", "2026-09-26"), null);
  assert.equal(findAnchoredEvent(EVENTS, "#nope", "2026-09-26"), null);
});

test("assistant context lists date, title, time, and location", () => {
  const text = calendarContextText(EVENTS, NOW);
  assert.match(text, /^UPCOMING BAND CALENDAR \(next 30 days from Saturday, September 26, 2026/);
  assert(text.includes("- Tuesday, September 29: Event evt-reh, 4pm – 7pm, AHS"));
  assert(text.includes("- Saturday, September 26: Event evt-sale, 10am – 4pm, Ashley full-size gym. Public sale."));
  assert(text.includes("Event evt-late, Starts 8am"));
  assert(!text.includes("evt-past"));
  assert(!text.includes("12am"));
});

test("the week runs through the coming weekend", () => {
  const at = (iso) => Date.parse(iso);
  // Saturday: seven days would stop on Friday, so the window stretches to Sunday.
  assert.equal(weekWindowDays(at("2026-09-26T10:00:00-04:00")), 9);
  // Sunday: seven days would stop on Saturday, so it gains Sunday.
  assert.equal(weekWindowDays(at("2026-09-27T10:00:00-04:00")), 8);
  // Monday through Sunday already covers the weekend.
  assert.equal(weekWindowDays(at("2026-09-28T10:00:00-04:00")), 7);
  assert.equal(weekWindowDays(at("2026-10-02T10:00:00-04:00")), 7);
  const events = [
    { id: "evt-1", title: "Marching Rehearsal", start: "2026-09-29T16:00", end: "2026-09-29T19:00" },
    { id: "evt-2", title: "Saturday Rehearsal", start: "2026-10-03T08:00", end: "2026-10-03T12:00" }
  ];
  const now = at("2026-09-26T14:00:00-04:00");
  const titles = upcomingList(events, now, { days: weekWindowDays(now) }).map((ev) => ev.title);
  assert.deepEqual(titles, ["Marching Rehearsal", "Saturday Rehearsal"]);
});
