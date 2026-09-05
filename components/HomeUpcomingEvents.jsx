"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function eventDate(start) {
  return new Date(`${start.slice(0, 10)}T12:00:00`);
}

function eventTime(start) {
  if (!start.includes("T")) return "All day";
  return new Date(start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function HomeUpcomingEvents() {
  const [events, setEvents] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/calendar-data.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Calendar unavailable");
        return response.json();
      })
      .then((rows) => {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
        setEvents(rows.filter((event) => String(event.end || event.start).slice(0, 10) >= today)
          .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3));
      })
      .catch((error) => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, []);

  let body;
  if (events?.length) {
    body = (
      <ol className="home-dates-list">
        {events.map((event) => {
          const date = eventDate(event.start);
          return (
            <li key={`${event.id}:${event.start}`}>
              <time dateTime={event.start} className="home-dates-badge">
                <span>{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
                <strong>{date.toLocaleDateString("en-US", { day: "numeric" })}</strong>
                <span>{date.toLocaleDateString("en-US", { month: "short" })}</span>
              </time>
              <div className="home-dates-body">
                <Link href="/calendar">{event.title}</Link>
                <span>
                  {eventTime(event.start)}
                  {event.location ? ` · ${event.location}` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    );
  } else if (failed) {
    body = <p className="home-dates-empty">Open the band calendar for current dates.</p>;
  } else if (events) {
    body = <p className="home-dates-empty">See the calendar for the full schedule.</p>;
  } else {
    body = <p className="home-dates-empty">Loading upcoming dates…</p>;
  }

  return (
    <aside className="home-dates" aria-labelledby="home-dates-title">
      <p className="eyebrow">From the official band calendar</p>
      <h2 id="home-dates-title">Upcoming dates</h2>
      {body}
      <Link className="home-dates-more" href="/calendar">Full calendar and subscription options</Link>
    </aside>
  );
}
