"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import {
  ASCEND_AREAS,
  ASCEND_AREA_IDS,
  ASCEND_ZONES,
  RATING_LABELS,
  aggregateAscend,
  drillMatches,
} from "@/lib/ascendCheck.mjs";
import styles from "./results.module.css";

function Counts({ c }) {
  if (!c.red && !c.yellow && !c.green) return <span className={styles.none}>No ratings</span>;
  return <span className={styles.counts}>
    <span data-rating="red">{c.red} Lost</span>
    <span data-rating="yellow">{c.yellow} Shaky</span>
    <span data-rating="green">{c.green} Got it</span>
  </span>;
}

// Read-only student results (#172). Shared by the staff room Kids tab and the admin page.
// fetcher(url) returns the parsed body, or null when the caller handled the response (e.g. sign-out).
// Pass `date` to control the day from outside (the staff room shares one date across tabs).
export default function AscendResults({ fetcher, endpoint, date: controlledDate }) {
  const [ownDate, setDate] = useState("");
  const date = controlledDate ?? ownDate;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ drill: "", zone: "", area: "" });
  const [detail, setDetail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await fetcher(`${endpoint}${date ? `?date=${encodeURIComponent(date)}` : ""}`);
      if (!body) return;
      setData(body);
      if (controlledDate == null) setDate(body.date);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [fetcher, endpoint, date, controlledDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = data?.submissions || [];
  const view = aggregateAscend(rows, filters);
  const areas = view.areas;
  const detailRow = rows.find((row) => row.drill_number === detail);
  const setFilter = (key) => (event) => setFilters((f) => ({ ...f, [key]: event.target.value }));

  return <>
    <section className={styles.filters} aria-label="Filters">
      {controlledDate == null ? <Field label="Rehearsal date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={styles.input} />
      </Field> : null}
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
    {controlledDate == null && data?.dates?.length ? <p className={styles.muted}>Dates with checks: {data.dates.map((d) => <button type="button" key={d.value} className={styles.link} onClick={() => setDate(d.value)}>{d.value} ({d.count})</button>)}</p> : null}

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
        <h2 id="detail-heading">One drill number</h2>
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
  </>;
}
