"use client";

import { useEffect, useMemo, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(s) {
  // "2026-08-28" or "2026-08-28T19:00" -> {y,m,d} in local terms, no TZ math
  const [date] = String(s).split("T");
  const [y, m, d] = date.split("-").map(Number);
  return { y, m: m - 1, d };
}

function timeLabel(start) {
  if (!start || !start.includes("T")) return null;
  const [, t] = start.split("T");
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

export default function CalendarView() {
  const [events, setEvents] = useState(null);
  const [cursor, setCursor] = useState(null); // {y, m}

  useEffect(() => {
    fetch("/calendar-data.json")
      .then((r) => r.json())
      .then((rows) => {
        setEvents(rows);
        const today = new Date();
        // Start on the first month that still has upcoming events, else this month.
        const next = rows.find((e) => {
          const a = ymd(e.start);
          return new Date(a.y, a.m, a.d) >= new Date(today.getFullYear(), today.getMonth(), 1);
        });
        const a = next ? ymd(next.start) : { y: today.getFullYear(), m: today.getMonth() };
        setCursor({ y: a.y, m: a.m });
      })
      .catch(() => setEvents([]));
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

  const upcoming = useMemo(() => {
    if (!events) return [];
    const today = new Date();
    const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return events
      .filter((e) => {
        const a = ymd(e.end && e.all_day ? e.end : e.start);
        return new Date(a.y, a.m, a.d) >= floor;
      })
      .sort((x, y) => x.start.localeCompare(y.start))
      .slice(0, 12);
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

  return (
    <div className="cal-wrap">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <h2>{MONTHS[m]} {y}</h2>
        <button className="cal-nav" onClick={() => step(1)} aria-label="Next month">›</button>
      </div>

      <div className="cal-grid cal-dow">
        {DOW.map((d) => <div key={d} className="cal-dowcell">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          const key = d ? `${y}-${m}-${d}` : `pad-${i}`;
          const evs = d ? (byDay[key] || []) : [];
          return (
            <div key={key} className={`cal-cell${d ? "" : " cal-pad"}${isToday(d) ? " cal-today" : ""}`}>
              {d && <span className="cal-daynum">{d}</span>}
              {evs.map((ev, j) => (
                <span key={j} className="cal-chip" title={ev.title}>
                  {timeLabel(ev.start) && <b>{timeLabel(ev.start)} </b>}{ev.title}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <h2 className="cal-up-h">Coming up</h2>
      <ul className="cal-up">
        {upcoming.map((ev, i) => {
          const a = ymd(ev.start);
          const e = ev.end && ev.all_day ? ymd(ev.end) : null;
          const range = e
            ? `${MONTHS[a.m].slice(0, 3)} ${a.d}–${e.m === a.m ? e.d : `${MONTHS[e.m].slice(0, 3)} ${e.d}`}`
            : `${MONTHS[a.m].slice(0, 3)} ${a.d}`;
          return (
            <li key={i}>
              <span className="cal-up-date">{range}</span>
              <span className="cal-up-title">
                {ev.title}
                {timeLabel(ev.start) && <em> · {timeLabel(ev.start)}</em>}
                {ev.location && <span className="cal-up-loc"> — {ev.location}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
