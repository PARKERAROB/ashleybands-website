"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffHomeView } from "@/lib/staffHome";
import { staffRoleDescription, staffRoleLabel } from "@/lib/staffRoles";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "./admin.module.css";

// Task-first staff home (#131). What each role sees comes from lib/staffHome.js.
const ORIENTATION_KEY = "ab_staff_home_orientation_dismissed_v1";
const HELP_EMAIL = "robert.parker@nhcs.net";

export default function AdminHome() {
  return <StaffGate>{(session) => <StaffHome session={session} />}</StaffGate>;
}

function readOrientationDismissed() {
  try {
    return window.localStorage.getItem(ORIENTATION_KEY) === "1";
  } catch {
    return false;
  }
}

function StaffHome({ session }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  // StaffGate renders this only after mount, so reading the browser here is safe.
  const [showOrientation, setShowOrientation] = useState(() => !readOrientationDismissed());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/operations-summary", {
      headers: staffAuthHeaders(session),
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Current counts could not be loaded.");
      setSummary(body);
    }).catch((loadError) => {
      if (loadError.name !== "AbortError") setError(loadError.message);
    });
    return () => controller.abort();
  }, [session]);

  const dismissOrientation = () => {
    setShowOrientation(false);
    try {
      window.localStorage.setItem(ORIENTATION_KEY, "1");
    } catch {
      // The panel simply returns next visit.
    }
  };

  const view = staffHomeView(session, summary, { summaryError: Boolean(error) });

  return <main className={styles.page}>
    <section className={styles.heading}>
      <p className={styles.signedIn}>Signed in as <strong>{session.display_name || "staff member"}</strong> · {staffRoleLabel(session.role)}</p>
      <h1>What do you need to do?</h1>
      <p className={styles.roleLine}>{staffRoleDescription(session.role)}</p>
    </section>

    {showOrientation ? <aside className={styles.orientation} aria-label="Getting started">
      <div>
        <p>This is your workspace. Everything here is private to staff.</p>
        <p>Start with a task below.</p>
        <p>Every page has a Home link at the top.</p>
      </div>
      <button type="button" onClick={dismissOrientation}>Got it</button>
    </aside> : null}

    {view.status === "loading" ? <p className={styles.notice} role="status">Loading what you can work on…</p> : null}
    {view.status === "error" ? <p className={styles.notice} role="alert">Your assignments could not be loaded. Refresh the page. If it keeps happening, email Mr. Parker.</p> : null}
    {view.status === "unassigned" ? <section className={styles.empty}>
      <h2>Nothing assigned yet</h2>
      <p>Mr. Parker hasn&apos;t assigned you to an event or area yet. Ask him to add you.</p>
    </section> : null}
    {!view.limited && error ? <p className={styles.notice}>Live counts are not available right now. Every task still works.</p> : null}

    {view.tasks.length ? <section className={styles.taskGrid} aria-label="Your tasks">
      {view.tasks.map((task) => {
        const metric = task.metric ? summary?.metrics?.[task.metric] : null;
        return <Link key={task.id} href={task.href} className={styles.taskCard}>
          <span className={styles.taskTitle}>{task.title}<b aria-hidden="true">→</b></span>
          <span className={styles.taskDetail}>{task.detail}</span>
          {metric ? <span className={styles.metric}>{metric.value} {metric.unit}</span> : null}
        </Link>;
      })}
    </section> : null}

    {view.groups.length ? <section className={styles.supporting} aria-label="Other tools">
      <h2>Other tools</h2>
      <div className={styles.supportGrid}>{view.groups.map((group) => <div key={group.title}>
        <strong>{group.title}</strong>
        <nav aria-label={group.title}>{group.links.map((link) => <Link key={link.href} href={link.href}>{link.label}<span aria-hidden="true">→</span></Link>)}</nav>
      </div>)}</div>
    </section> : null}

    <p className={styles.help}>Need help? Email Mr. Parker at <a href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a>.</p>
  </main>;
}
