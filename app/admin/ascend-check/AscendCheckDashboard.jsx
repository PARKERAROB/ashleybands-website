"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { Button, Field, Notice, PageHeader } from "@/components/ui";
import { staffAuthHeaders } from "@/lib/staffSession";
import {
  ASCEND_AREAS,
  ASCEND_AREA_IDS,
  ASCEND_ZONES,
  RATING_LABELS,
  aggregateAscend,
  drillMatches,
} from "@/lib/ascendCheck.mjs";
import styles from "./ascend-check-dashboard.module.css";

export default function AscendCheckDashboard() {
  return <StaffGate>{(session, signOut) => <Dashboard session={session} signOut={signOut} />}</StaffGate>;
}

function Counts({ c }) {
  if (!c.red && !c.yellow && !c.green) return <span className={styles.none}>No ratings</span>;
  return <span className={styles.counts}>
    <span data-rating="red">{c.red} Lost</span>
    <span data-rating="yellow">{c.yellow} Shaky</span>
    <span data-rating="green">{c.green} Got it</span>
  </span>;
}

function Dashboard({ session, signOut }) {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ drill: "", zone: "", area: "" });
  const [detail, setDetail] = useState("");
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState("");

  const call = useCallback(async (url, init = {}) => {
    const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...staffAuthHeaders(session) } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await signOut();
      return null;
    }
    if (!response.ok) throw new Error(body.error || "That did not work. Try again.");
    return body;
  }, [session, signOut]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await call(`/api/admin/ascend-check${date ? `?date=${encodeURIComponent(date)}` : ""}`);
      if (!body) return;
      setData(body);
      setDate(body.date);
      setCode((current) => current || body.code);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [call, date]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveCode(event) {
    event.preventDefault();
    setCodeState("saving");
    try {
      const body = await call("/api/admin/ascend-check", { method: "PUT", body: JSON.stringify({ code }) });
      if (!body) return;
      setCode(body.code);
      setData((d) => ({ ...d, code: body.code }));
      setCodeState("saved");
    } catch (saveError) {
      setCodeState(saveError.message);
    }
  }

  const rows = data?.submissions || [];
  const view = aggregateAscend(rows, filters);
  const areas = view.areas;
  const detailRow = rows.find((row) => row.drill_number === detail);
  const setFilter = (key) => (event) => setFilters((f) => ({ ...f, [key]: event.target.value }));

  return <main className={styles.page}>
    <PageHeader title="Ascend Self Checks" lede="What students say about each cleaning zone. Compare it with your own flags." />

    <section className={styles.panel} aria-labelledby="code-heading">
      <h2 id="code-heading">Rehearsal code</h2>
      <p className={styles.muted}>Students type this before they send. Change it any time. The old code stops working right away.</p>
      <form className={styles.row} onSubmit={saveCode}>
        <Field label="Code">
          <input value={code} onChange={(e) => { setCode(e.target.value); setCodeState(""); }} minLength={3} maxLength={40} autoComplete="off" className={styles.input} />
        </Field>
        <Button type="submit" variant="secondary" disabled={codeState === "saving"}>{codeState === "saving" ? "Saving…" : "Save code"}</Button>
      </form>
      {codeState === "saved" ? <p className={styles.ok}>Saved. Students now use {data?.code}.</p> : null}
      {codeState && !["saved", "saving"].includes(codeState) ? <p className={styles.bad} role="alert">{codeState}</p> : null}
      {data && !data.code ? <Notice tone="deadline" title="No code is set yet.">Students cannot send until you save one.</Notice> : null}
    </section>

    <section className={styles.filters} aria-label="Filters">
      <Field label="Rehearsal date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={styles.input} />
      </Field>
      <Field label="Drill number" hint="A letter shows that whole section.">
        <input value={filters.drill} onChange={setFilter("drill")} placeholder="T or T3" autoComplete="off" className={styles.input} />
      </Field>
      <Field label="Zone">
        <select value={filters.zone} onChange={setFilter("zone")} className={styles.input}>
          <option value="">All zones</option>
          {ASCEND_ZONES.map((z) => <option key={z.id} value={z.id}>{z.sets} (m{z.measures})</option>)}
        </select>
      </Field>
      <Field label="Area">
        <select value={filters.area} onChange={setFilter("area")} className={styles.input}>
          <option value="">Music, Choreo and Marching</option>
          {ASCEND_AREA_IDS.map((a) => <option key={a} value={a}>{ASCEND_AREAS[a].label}</option>)}
        </select>
      </Field>
    </section>
    {data?.dates?.length ? <p className={styles.muted}>Dates with checks: {data.dates.map((d) => <button type="button" key={d.value} className={styles.link} onClick={() => setDate(d.value)}>{d.value} ({d.count})</button>)}</p> : null}

    {error ? <Notice tone="error" title="The self checks did not load.">{error}</Notice> : null}
    {loading ? <p className={styles.muted}>Loading…</p> : null}

    {!loading && data ? <>
      <p className={styles.summary}><strong>{view.submissions}</strong> of {rows.length} self checks for {data.date} match these filters.</p>

      <section aria-labelledby="worst-heading">
        <h2 id="worst-heading">Worst zones first</h2>
        <p className={styles.muted}>Lost counts twice, Shaky once.</p>
        {view.ranked.length ? <ol className={styles.ranked}>
          {view.ranked.map((z) => <li key={z.id}><b>Sets {z.sets}</b> <span className={styles.muted}>m{z.measures} · {z.letters}</span> <Counts c={z.totals} /></li>)}
        </ol> : <p className={styles.empty}>No Lost or Shaky ratings here yet.</p>}
      </section>

      <section aria-labelledby="grid-heading">
        <h2 id="grid-heading">Every zone</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Zone</th>{areas.map((a) => <th scope="col" key={a}>{ASCEND_AREAS[a].label}</th>)}</tr></thead>
            <tbody>{view.zones.map((z) => <tr key={z.id}>
              <th scope="row">Sets {z.sets}<br /><span className={styles.muted}>m{z.measures} · {z.letters}{z.hit ? " · hit" : ""}</span></th>
              {areas.map((a) => <td key={a}><Counts c={z.counts[a]} /></td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="detail-heading">
        <h2 id="detail-heading">One student&apos;s check</h2>
        <Field label="Drill number">
          <select value={detail} onChange={(e) => setDetail(e.target.value)} className={styles.input}>
            <option value="">Choose a drill number</option>
            {rows.filter((r) => drillMatches(r.drill_number, filters.drill)).map((r) => <option key={r.drill_number} value={r.drill_number}>{r.drill_number}</option>)}
          </select>
        </Field>
        {detailRow ? <div className={styles.detail}>
          <p className={styles.muted}>Sent {new Date(detailRow.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          {ASCEND_ZONES.filter((z) => detailRow.payload?.zones?.[z.id]).map((z) => {
            const entry = detailRow.payload.zones[z.id];
            return <article key={z.id} className={styles.panel}>
              <h3>Sets {z.sets} <span className={styles.muted}>m{z.measures} · {z.letters}</span></h3>
              <p className={styles.counts}>{ASCEND_AREA_IDS.filter((a) => entry.rate?.[a]).map((a) => <span key={a} data-rating={entry.rate[a]}>{ASCEND_AREAS[a].label}: {RATING_LABELS[entry.rate[a]]}</span>)}</p>
              {ASCEND_AREA_IDS.some((a) => entry.checks?.[a]?.length) ? <ul>{ASCEND_AREA_IDS.flatMap((a) => (entry.checks?.[a] || []).map((i) => <li key={a + i}>{ASCEND_AREAS[a].label}: {ASCEND_AREAS[a].checks[i]}</li>))}</ul> : null}
              {entry.note ? <p className={styles.note}>{entry.note}</p> : null}
            </article>;
          })}
        </div> : null}
      </section>
      <Button variant="quiet" onClick={load}>Refresh</Button>
    </> : null}
  </main>;
}
