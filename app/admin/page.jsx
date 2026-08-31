"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffHasCapability, STAFF_CAPABILITIES } from "@/lib/staffCapabilities";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "./admin.module.css";

const AREAS = [
  { id: "students", capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/students", title: "Students", prompt: "Find anyone or build a roster.", accent: "garnet" },
  { id: "attendance", capability: STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ, href: "/admin/attendance?view=ready", title: "Attendance", prompt: "Take attendance or find a pattern.", accent: "amber" },
  { id: "financial", capability: STAFF_CAPABILITIES.BILLING_READ, href: "/admin/financial?view=campaign&filter=under100", title: "Funding & money", prompt: "Answer a fee or campaign question.", accent: "green" },
  { id: "forms", capability: STAFF_CAPABILITIES.FORMS_STATUS_READ, href: "/admin/forms?view=needs", title: "Forms", prompt: "Find exactly what is missing.", accent: "blue" },
  { id: "assets", capability: STAFF_CAPABILITIES.ASSETS_READ, href: "/admin/assets", title: "Assets & inventory", prompt: "Find an asset or current assignment.", accent: "purple" },
  { id: "ensembles", capability: STAFF_CAPABILITIES.MEMBERSHIPS_READ, href: "/admin/ensembles", title: "Ensembles", prompt: "Open a group or build a roster.", accent: "garnet" },
  { id: "calendar", capability: STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ, href: "/calendar", title: "Calendar & events", prompt: "Open the dates that drive the program.", accent: "amber" },
  { id: "communication", capability: STAFF_CAPABILITIES.COMMUNICATIONS_READ, href: "/admin/broadcast", title: "Communication", prompt: "Build the right family audience.", accent: "green" },
];

const SUPPORTING = [
  {
    title: "People & records",
    links: [
      { capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/contacts", label: "Contacts & guardians" },
      { capability: STAFF_CAPABILITIES.STUDENTS_WRITE, href: "/admin/students/manage", label: "Manage student records" },
      { capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/profile-requests", label: "Profile activity" },
      { capability: STAFF_CAPABILITIES.STUDENTS_READ, href: "/admin/measurements", label: "Measurements & sizes" },
    ],
  },
  {
    title: "Operational tools",
    links: [
      { capability: [STAFF_CAPABILITIES.FORMS_STATUS_READ, STAFF_CAPABILITIES.BILLING_READ], href: "/admin/carnegie-2027", label: "Carnegie commitment sheet" },
      { capability: STAFF_CAPABILITIES.BILLING_WRITE, href: "/admin/billing", label: "Fee ledger tools" },
      { capability: STAFF_CAPABILITIES.ASSETS_READ, href: "/admin/instrument-inventory", label: "Instrument fulfillment" },
      { capability: STAFF_CAPABILITIES.ASSETS_READ, href: "/admin/music-library", label: "Music intake" },
      { capability: STAFF_CAPABILITIES.COMMUNICATIONS_READ, href: "/admin/newsletter", label: "AshleyBands Weekly" },
      { capability: STAFF_CAPABILITIES.FUNDING_READ, href: "/admin/marching-band/funding", label: "Marching roster & funding" },
      { capability: STAFF_CAPABILITIES.MEMBERSHIPS_READ, href: "/admin/marching-band", label: "Marching status" },
    ],
  },
  {
    title: "System",
    links: [
      { capability: STAFF_CAPABILITIES.SYSTEM_OVERSIGHT_READ, href: "/admin/system", label: "Audit, recovery & staff access" },
      { capability: STAFF_CAPABILITIES.SYSTEM_DATA_INVENTORY_READ, href: "/admin/data-inventory", label: "Data inventory" },
    ],
  },
  {
    title: "Sponsorship",
    links: [
      { capability: STAFF_CAPABILITIES.SPONSORSHIP_READ, href: "/sponsors/dashboard", label: "Sponsor tracker" },
    ],
  },
];

export default function AdminHome() {
  return <StaffGate>{(session, signOut) => <CommandCenter session={session} signOut={signOut} />}</StaffGate>;
}

function CommandCenter({ session, signOut }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/operations-summary", {
      headers: staffAuthHeaders(session),
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Current operational counts could not be loaded.");
      setSummary(body);
    }).catch((loadError) => {
      if (loadError.name !== "AbortError") setError(loadError.message);
    });
    return () => controller.abort();
  }, [session]);

  const limitedRole = ["booster_treasurer", "event_worker"].includes(session.role);
  const assignedCapabilities = new Set(summary?.authorizedCapabilities || []);
  const assigned = (capability) => !limitedRole
    || (summary?.scoped && (assignedCapabilities.has("*") || assignedCapabilities.has(capability)));
  const areas = AREAS.filter((area) => staffHasCapability(session, area.capability) && assigned(area.capability));
  const sections = SUPPORTING.map((section) => ({
    ...section,
    links: section.links.filter((link) => staffHasCapability(session, link.capability) && assigned(link.capability)),
  })).filter((section) => section.links.length);

  return <main className={styles.page}>
    <header className={styles.appBar}>
      <div><strong>Ashley Bands</strong><span>Staff command center</span></div>
      <div><span>{session.display_name}</span><button type="button" onClick={signOut}>Sign out</button></div>
    </header>

    <section className={styles.heading}>
      <div><p>Current operations</p><h1>What do you need to work on?</h1></div>
      <p>Start with an area. Narrow to the exact students, records, or next action.</p>
    </section>

    {error ? <p className={styles.notice} role="alert">Live counts are unavailable. Every workspace is still available below.</p> : null}
    {summary?.unavailable?.length ? <p className={styles.notice}>Some live counts are unavailable. Open the area for its current records.</p> : null}

    <section className={styles.areaGrid} aria-label="Operational areas">
      {areas.map((area) => {
        const metric = summary?.metrics?.[area.id];
        return <Link key={area.id} href={area.href} className={styles.areaCard} data-accent={area.accent}>
          <span className={styles.metric}><strong>{metric ? metric.value : "—"}</strong> {metric?.unit || "current records"}</span>
          <span className={styles.areaTitle}>{area.title}<b aria-hidden="true">→</b></span>
          <span className={styles.prompt}>{area.prompt}</span>
        </Link>;
      })}
    </section>

    <section className={styles.routeNote}>
      <strong>Two useful directions</strong>
      <span>Start with Funding to find everyone under $100, or open one student and carry that student into every connected area.</span>
    </section>

    <section className={styles.supporting} aria-label="Supporting staff tools">
      <h2>Supporting tools</h2>
      <div className={styles.supportGrid}>{sections.map((section) => <div key={section.title}>
        <strong>{section.title}</strong>
        <nav>{section.links.map((link) => <Link key={link.href} href={link.href}>{link.label}<span>→</span></Link>)}</nav>
      </div>)}</div>
    </section>
  </main>;
}
