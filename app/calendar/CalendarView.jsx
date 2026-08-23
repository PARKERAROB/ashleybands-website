"use client";

import { useEffect, useMemo, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Category -> display group + accent color, harmonized with the site's garnet/gold palette.
const CAT_GROUPS = [
  { label: "Marching Band", color: "#7b1829", match: (c) => c === "MB" || c.startsWith("MB-") },
  { label: "Concert", color: "#245c73", match: (c) => c === "Concert" },
  { label: "Jazz", color: "#1f6f6a", match: (c) => c === "Jazz" },
  { label: "Honor Bands", color: "#446349", match: (c) => ["AllCounty", "AllDistrict", "AllState"].includes(c) },
  { label: "MPA", color: "#a9781f", match: (c) => c === "MPA" },
  { label: "CCC", color: "#6b3a5b", match: (c) => c === "CCC" },
  { label: "Trip", color: "#b5551f", match: (c) => c === "Trip" },
  { label: "WSW", color: "#4a5a7a", match: (c) => c === "WSW" },
  { label: "School", color: "#6f675a", match: (c) => c === "School" }
];
const OTHER = { label: "Other", color: "#8a7f6d", match: () => true };

function groupFor(cat) {
  const c = String(cat || "");
  return CAT_GROUPS.find((g) => g.match(c)) || OTHER;
}

function ymd(s) {
  // "2026-08-28" or "2026-08-28T19:00" -> {y,m,d} in local terms, no TZ math
  const [date] = String(s).split("T");
  const [y, m, d] = date.split("-").map(Number);
  return { y, m: m - 1, d };
}

function timeLabel(start) {
  if (!start || !String(start).includes("T")) return null;
  const [, t] = String(start).split("T");
  let [h, min] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return min ? `${h}:${String(min).padStart(2, "0")}${ap}` : `${h}${ap}`;
}

// Expand an event across the inclusive days it covers (for multi-day all-days).
function coveredDates(ev) {
  const a = ymd(ev.start);
  const out = [`${a.y}-${a.m}-${a.d}`];
  if (ev.end && ev.all_day) {
    const start = new Date(a.y, a.m, a.d);
    const e = ymd(ev.end);
    const end = new Date(e.y, e.m, e.d);
    for (let t = new Date(start); t < end; ) {
      t.setDate(t.getDate() + 1);
      if (t <= end) out.push(`${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`);
    }
  }
  return out;
}

// Start time, or a "start – end" range when the event carries a real end time.
function timeRange(ev) {
  const t = timeLabel(ev.start);
  if (!t) return null;
  const te = ev.end && String(ev.end).includes("T") ? timeLabel(ev.end) : null;
  return te ? `${t} – ${te}` : t;
}

function whenLabel(ev) {
  const a = ymd(ev.start);
  if (ev.end && ev.all_day) {
    const e = ymd(ev.end);
    const estr = e.m === a.m ? `${e.d}` : `${MONTHS[e.m]} ${e.d}`;
    return `${MONTHS[a.m]} ${a.d}–${estr}, ${a.y}`;
  }
  const tr = timeRange(ev);
  return tr ? `${MONTHS[a.m]} ${a.d}, ${a.y} · ${tr}` : `${MONTHS[a.m]} ${a.d}, ${a.y}`;
}

// --- "Add to my calendar" link builders ---
const pad2 = (n) => String(n).padStart(2, "0");
const gdate = ({ y, m, d }) => `${y}${pad2(m + 1)}${pad2(d)}`;
const addDays = (o, n) => {
  const t = new Date(o.y, o.m, o.d + n);
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
};
function gdatetime(s) {
  const [date, t] = String(s).split("T");
  const { y, m, d } = ymd(date);
  const [h, mi] = t.split(":").map(Number);
  return `${y}${pad2(m + 1)}${pad2(d)}T${pad2(h)}${pad2(mi || 0)}00`;
}
function addHourStr(s) {
  const [date, t] = String(s).split("T");
  const { y, m, d } = ymd(date);
  const [h, mi] = t.split(":").map(Number);
  const dt = new Date(y, m, d, h + 1, mi || 0);
  return `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`;
}
function dateRange(ev) {
  if (!String(ev.start).includes("T")) {
    const s = ymd(ev.start);
    const endEx = addDays(ev.end ? ymd(ev.end) : s, 1);
    return { start: gdate(s), end: gdate(endEx), allDay: true };
  }
  // Use the event's real end time; fall back to a 1-hour block only if none is set.
  const end = ev.end && String(ev.end).includes("T") ? gdatetime(ev.end) : addHourStr(ev.start);
  return { start: gdatetime(ev.start), end, allDay: false };
}
function gcalLink(ev) {
  const r = dateRange(ev);
  const p = new URLSearchParams({ action: "TEMPLATE", text: ev.title || "Band Event", dates: `${r.start}/${r.end}` });
  if (ev.location) p.set("location", ev.location);
  if (ev.description) p.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
function icsDataUri(ev) {
  const r = dateRange(ev);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ashley Bands//Calendar//EN", "BEGIN:VEVENT",
    `UID:${ev.id || ev.title}@ashleybands.com`,
    `SUMMARY:${ev.title || "Band Event"}`,
    r.allDay ? `DTSTART;VALUE=DATE:${r.start}` : `DTSTART:${r.start}`,
    r.allDay ? `DTEND;VALUE=DATE:${r.end}` : `DTEND:${r.end}`
  ];
  if (ev.location) lines.push(`LOCATION:${ev.location}`);
  if (ev.description) lines.push(`DESCRIPTION:${ev.description}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
}

export default function CalendarView() {
  const [events, setEvents] = useState(null);
  const [cursor, setCursor] = useState(null); // {y, m}
  const [view, setView] = useState("month"); // "month" | "agenda"
  const [openEvent, setOpenEvent] = useState(null);
  const [openDay, setOpenDay] = useState(null); // day key "y-m-d"

  useEffect(() => {
    fetch("/calendar-data.json")
      .then((r) => r.json())
      .then((rows) => {
        setEvents(rows);
        const today = new Date();
        const next = rows.find((e) => {
          const a = ymd(e.start);
          return new Date(a.y, a.m, a.d) >= new Date(today.getFullYear(), today.getMonth(), 1);
        });
        const a = next ? ymd(next.start) : { y: today.getFullYear(), m: today.getMonth() };
        setCursor({ y: a.y, m: a.m });
      })
      .catch(() => setEvents([]));
    // Phones default to the agenda list, which reads far better than a squeezed grid.
    if (typeof window !== "undefined" && window.innerWidth < 720) setView("agenda");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setOpenEvent(null); setOpenDay(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const byDay = useMemo(() => {
    const map = {};
    (events || []).forEach((ev) => {
      coveredDates(ev).forEach((k) => {
        (map[k] = map[k] || []).push(ev);
      });
    });
    return map;
  }, [events]);

  const agenda = useMemo(() => {
    if (!events) return [];
    const today = new Date();
    const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const up = events
      .filter((e) => {
        const a = ymd(e.end && e.all_day ? e.end : e.start);
        return new Date(a.y, a.m, a.d) >= floor;
      })
      .sort((x, y) => String(x.start).localeCompare(String(y.start)));
    const groups = [];
    let cur = null;
    up.forEach((ev) => {
      const a = ymd(ev.start);
      const label = `${MONTHS[a.m]} ${a.y}`;
      if (!cur || cur.label !== label) { cur = { label, items: [] }; groups.push(cur); }
      cur.items.push(ev);
    });
    return groups;
  }, [events]);

  const legend = useMemo(() => {
    const seen = new Set();
    const out = [];
    (events || []).forEach((e) => {
      const g = groupFor(e.category);
      if (!seen.has(g.label)) { seen.add(g.label); out.push(g); }
    });
    return out;
  }, [events]);

  if (!events || !cursor) {
    return <p className="cal-loading">Loading the calendar…</p>;
  }

  const { y, m } = cursor;
  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d) => d && y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
  const step = (delta) => {
    const nm = m + delta;
    setCursor({ y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 });
  };
  const goToday = () => setCursor({ y: today.getFullYear(), m: today.getMonth() });

  const chipStyle = (ev) => {
    const c = groupFor(ev.category).color;
    return { background: `${c}1e`, borderLeft: `3px solid ${c}` };
  };

  const Chip = ({ ev }) => (
    <button type="button" className="cal-chip" style={chipStyle(ev)} onClick={() => setOpenEvent(ev)} title={ev.title}>
      {timeLabel(ev.start) && <b>{timeLabel(ev.start)} </b>}{ev.title}
    </button>
  );

  return (
    <div className="cal-wrap">
      <div className="cal-toolbar">
        <div className="cal-toolbar-nav">
          <button className="cal-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
          <h2>{MONTHS[m]} {y}</h2>
          <button className="cal-nav" onClick={() => step(1)} aria-label="Next month">›</button>
        </div>
        <div className="cal-toolbar-right">
          <button className="cal-btn" onClick={goToday}>Today</button>
          <div className="cal-toggle" role="group" aria-label="Calendar view">
            <button className={view === "month" ? "is-active" : ""} onClick={() => setView("month")}>Month</button>
            <button className={view === "agenda" ? "is-active" : ""} onClick={() => setView("agenda")}>List</button>
          </div>
        </div>
      </div>

      {legend.length > 0 && (
        <div className="cal-legend">
          {legend.map((g) => (
            <span key={g.label} className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: g.color }} />{g.label}
            </span>
          ))}
        </div>
      )}

      {view === "month" ? (
        <>
          <div className="cal-grid cal-dow">
            {DOW.map((d) => <div key={d} className="cal-dowcell">{d}</div>)}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              const key = d ? `${y}-${m}-${d}` : `pad-${i}`;
              const evs = d ? (byDay[key] || []) : [];
              const shown = evs.slice(0, 3);
              const extra = evs.length - shown.length;
              return (
                <div key={key} className={`cal-cell${d ? "" : " cal-pad"}${isToday(d) ? " cal-today" : ""}`}>
                  {d && <span className="cal-daynum">{d}</span>}
                  {shown.map((ev, j) => <Chip key={j} ev={ev} />)}
                  {extra > 0 && (
                    <button type="button" className="cal-more" onClick={() => setOpenDay(key)}>
                      +{extra} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="cal-agenda">
          {agenda.length === 0 && <p className="cal-loading">No upcoming events on the calendar right now.</p>}
          {agenda.map((grp) => (
            <div key={grp.label} className="cal-agenda-group">
              <h3 className="cal-agenda-month">{grp.label}</h3>
              {grp.items.map((ev, i) => {
                const a = ymd(ev.start);
                const g = groupFor(ev.category);
                return (
                  <button type="button" key={i} className="cal-agenda-row" onClick={() => setOpenEvent(ev)}>
                    <span className="cal-agenda-date">
                      <b>{a.d}</b><span>{DOW[new Date(a.y, a.m, a.d).getDay()]}</span>
                    </span>
                    <span className="cal-agenda-body">
                      <span className="cal-agenda-title">
                        <span className="cal-legend-dot" style={{ background: g.color }} />{ev.title}
                      </span>
                      <span className="cal-agenda-meta">
                        {timeRange(ev) && <span>{timeRange(ev)}</span>}
                        {ev.location && <span>{ev.location}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {openDay && (
        <div className="cal-modal-backdrop" onClick={() => setOpenDay(null)}>
          <div className="cal-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="cal-modal-close" onClick={() => setOpenDay(null)} aria-label="Close">×</button>
            <h3 className="cal-modal-day-h">
              {(() => { const [yy, mm, dd] = openDay.split("-").map(Number); return `${MONTHS[mm]} ${dd}, ${yy}`; })()}
            </h3>
            <div className="cal-modal-daylist">
              {(byDay[openDay] || []).map((ev, i) => (
                <button type="button" key={i} className="cal-agenda-row" onClick={() => { setOpenDay(null); setOpenEvent(ev); }}>
                  <span className="cal-agenda-body">
                    <span className="cal-agenda-title">
                      <span className="cal-legend-dot" style={{ background: groupFor(ev.category).color }} />{ev.title}
                    </span>
                    <span className="cal-agenda-meta">{timeRange(ev) && <span>{timeRange(ev)}</span>}{ev.location && <span>{ev.location}</span>}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {openEvent && (
        <div className="cal-modal-backdrop" onClick={() => setOpenEvent(null)}>
          <div className="cal-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="cal-modal-close" onClick={() => setOpenEvent(null)} aria-label="Close">×</button>
            <span className="cal-modal-tag" style={{ background: groupFor(openEvent.category).color }}>
              {groupFor(openEvent.category).label}
            </span>
            <h3 className="cal-modal-title">{openEvent.title}</h3>
            <p className="cal-modal-when">{whenLabel(openEvent)}</p>
            {openEvent.location && <p className="cal-modal-loc">{openEvent.location}</p>}
            {openEvent.description && <p>{openEvent.description}</p>}
            <div className="cal-modal-actions">
              <a className="button primary" href={gcalLink(openEvent)} target="_blank" rel="noopener noreferrer">
                Add to Google Calendar
              </a>
              <a className="button secondary" href={icsDataUri(openEvent)} download={`${(openEvent.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`}>
                Add to Apple / Outlook
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
