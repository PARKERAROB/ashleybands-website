"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./open-house.module.css";

const steps = [
  {
    id: "portal",
    number: "01",
    title: "Connect your family",
    body: "Sign in to the Family Portal. If your email is new, request access and verify it. Confirm that we can reach your family.",
    href: "/portal",
    action: "Open the Family Portal",
    confirm: "I signed in or requested access"
  },
  {
    id: "website",
    number: "02",
    title: "Save your one-stop shop",
    body: "AshleyBands.com is where dates, forms, requests, supplies, and program information live. Bookmark it now.",
    href: "/",
    action: "Explore AshleyBands.com",
    confirm: "I know where to start"
  },
  {
    id: "calendar",
    number: "03",
    title: "Subscribe to the calendar",
    body: "The band calendar is the official source for dates and times. Subscribe so later updates appear automatically.",
    href: "/calendar",
    action: "Open the band calendar",
    confirm: "I reviewed or subscribed to the calendar"
  },
  {
    id: "day-one",
    number: "04",
    title: "Be ready for Day 1",
    body: "Bring a personal instrument or submit a county-instrument request, a black one-inch binder, and a named band pencil that stays in the binder.",
    href: "/portal/review#instrument-request-heading",
    action: "Open the instrument agreement",
    confirm: "I understand the Day 1 list"
  },
  {
    id: "success",
    number: "05",
    title: "Know how band works",
    body: "Grades are 60% performance and 40% practice. Students are assessed consistently, usually once each week. Families email Mr. Parker; students use Google Chat.",
    href: "mailto:robert.parker@nhcs.net?subject=Ashley%20Bands%20Question",
    action: "Save Mr. Parker's email",
    confirm: "I know how to succeed and communicate"
  },
  {
    id: "clothing",
    number: "06",
    title: "Review clothing",
    body: "Place any Open House bulk clothing order by Friday, August 28. There is no individual shipping charge.",
    href: "/portal/clothing",
    action: "Open clothing order",
    confirm: "I reviewed the clothing collection"
  }
];

const storageKey = "ashley-bands-open-house-2026";

export default function BandReadyChallenge() {
  const [completed, setCompleted] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      // Restore progress after hydration; localStorage is unavailable during server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompleted(JSON.parse(window.localStorage.getItem(storageKey) || "{}"));
    } catch {
      setCompleted({});
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(storageKey, JSON.stringify(completed));
  }, [completed, loaded]);

  const count = useMemo(() => steps.filter((step) => completed[step.id]).length, [completed]);
  const finished = count === steps.length;

  function toggle(id) {
    setCompleted((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Ashley Bands Open House</p>
        <h1>Get Band Ready.</h1>
        <p>Six quick stops. Everything your family needs to begin the year connected and confident.</p>
        <div className={styles.progress} aria-label={`${count} of ${steps.length} steps complete`}>
          <div className={styles.progressTrack}><span style={{ width: `${(count / steps.length) * 100}%` }} /></div>
          <strong>{count} of {steps.length} complete</strong>
        </div>
      </header>

      <section className={styles.steps} aria-label="Band Ready steps">
        {steps.map((step) => (
          <article className={`${styles.card} ${completed[step.id] ? styles.done : ""}`} key={step.id}>
            <span className={styles.number}>{step.number}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              {step.href ? (
                step.href.startsWith("mailto:") ? <a className={styles.link} href={step.href}>{step.action}</a> : <Link className={styles.link} href={step.href}>{step.action}</Link>
              ) : null}
              <label className={styles.check}>
                <input type="checkbox" checked={Boolean(completed[step.id])} onChange={() => toggle(step.id)} />
                <span>{step.confirm}</span>
              </label>
            </div>
          </article>
        ))}
      </section>

      <section className={`${styles.finish} ${finished ? styles.finishReady : ""}`} aria-live="polite">
        {finished ? (
          <>
            <p className={styles.eyebrow}>Challenge complete</p>
            <h2>Your family is Band Ready!</h2>
            <p>Show this screen at the prize table to claim your Ashley Bands sticker.</p>
            <div className={styles.badge}>READY 2026</div>
          </>
        ) : (
          <>
            <h2>Your sticker is waiting.</h2>
            <p>Complete all five stops, then show the Band Ready screen to a student helper.</p>
          </>
        )}
      </section>
    </>
  );
}
