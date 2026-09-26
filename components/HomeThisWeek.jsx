"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { upcomingList } from "@/lib/thisWeek.mjs";
import styles from "./HomeThisWeek.module.css";

// Compact "This week" strip for the home page (#134). The home page prerenders on the
// client, so the 7-day window is computed after mount to avoid a hydration mismatch.
export default function HomeThisWeek() {
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/calendar-data.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Calendar unavailable");
        return response.json();
      })
      .then((rows) => {
        const week = upcomingList(rows, Date.now(), { days: 7 });
        setTotal(week.length);
        setItems(week.slice(0, 4));
      })
      .catch((error) => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, []);

  let body;
  if (items?.length) {
    body = (
      <ol className={styles.list}>
        {items.map((event) => (
          <li key={event.anchor} className={styles.item}>
            <span className={styles.day}>{event.dayLabel}</span>
            <Link className={styles.title} href={event.href}>{event.title}</Link>
            <span className={styles.meta}>
              {event.time}
              {event.location ? ` · ${event.location}` : ""}
            </span>
          </li>
        ))}
      </ol>
    );
  } else if (failed) {
    body = <p className={styles.empty}>Open the band calendar for current dates.</p>;
  } else if (items) {
    body = <p className={styles.empty}>Nothing on the band calendar in the next 7 days.</p>;
  } else {
    body = <p className={styles.empty}>Loading this week&apos;s dates…</p>;
  }

  return (
    <section className={styles.strip} aria-labelledby="home-this-week-title">
      <div className={styles.head}>
        <h2 id="home-this-week-title">This week</h2>
        {items?.length || !items ? (
          <Link className={styles.more} href="/this-week">
            See this week{total > 4 ? ` (${total - 4} more)` : ""} <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <Link className={styles.more} href="/calendar">
            Full band calendar <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {body}
    </section>
  );
}
