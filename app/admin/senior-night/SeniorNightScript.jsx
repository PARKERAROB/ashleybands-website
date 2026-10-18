"use client";
import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import { PageHeader, Notice, Button, StatusChip } from "@/components/ui";
import { scriptEntry } from "@/lib/seniorNight.mjs";
import styles from "@/app/portal/senior-night/senior-night.module.css";

export default function SeniorNightScript() { return <StaffGate>{(session, signOut) => <Script session={session} signOut={signOut} />}</StaffGate>; }

function Script({ session, signOut }) {
  const [rows, setRows] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/senior-night", { headers: staffAuthHeaders(session), cache: "no-store" });
      if (response.status === 401) { await signOut(); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setRows(body.rows);
    } catch (e) { setError(e.message || "Unable to load."); } finally { setLoading(false); }
  }, [session, signOut]);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);
  const answered = rows?.filter((row) => row.answers) || [];
  return (
    <main className={styles.page}>
      <PageHeader title="Senior Night script" lede="Built from each senior's Family Portal answers. Seniors fill the form at /portal/senior-night." />
      <div className={`${styles.actions} ${styles.noPrint}`}>
        <Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>
        <Button onClick={() => window.print()} disabled={!answered.length}>Print the script</Button>
      </div>
      {error ? <Notice tone="error" title="The list didn't load."><p>{error}</p></Notice> : null}
      {loading && !rows ? <p role="status">Loading seniors…</p> : null}
      {rows ? (
        <>
          <section className={styles.noPrint} aria-labelledby="who-heading">
            <h2 id="who-heading">{answered.length} of {rows.length} seniors have answered</h2>
            <ul className={styles.list}>
              {rows.map((row) => <li key={row.studentId}><span>{row.name}{row.marching ? "" : " (not in marching band)"}</span>{row.answers ? <StatusChip status="done" /> : <StatusChip status="needed" />}</li>)}
            </ul>
          </section>
          <section className={styles.script} aria-labelledby="script-heading">
            <h2 id="script-heading">Halftime announcer script</h2>
            {answered.length ? answered.map((row) => <p key={row.studentId}>{scriptEntry(row.answers)}</p>) : <p>No answers yet.</p>}
          </section>
        </>
      ) : null}
    </main>
  );
}
