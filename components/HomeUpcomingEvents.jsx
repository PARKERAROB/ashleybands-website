"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  return (
    <section className="home-dates" aria-labelledby="home-dates-title">
      <div>
        <p className="eyebrow">From the official band calendar</p>
        <h2 id="home-dates-title">Upcoming dates</h2>
        <Link className="text-link" href="/calendar">Full calendar and subscription options</Link>
      </div>
      {events?.length ? (
        <ul>
          {events.map((event) => (
            <li key={`${event.id}:${event.start}`}>
              <time dateTime={event.start}>
                {new Date(`${event.start.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {event.start.includes("T") && ` · ${new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
              </time>
              <Link href="/calendar">{event.title}</Link>
            </li>
          ))}
        </ul>
      ) : <p>{failed ? "Open the band calendar for current dates." : events ? "See the calendar for the full schedule." : "Loading upcoming dates…"}</p>}
    </section>
  );
}
