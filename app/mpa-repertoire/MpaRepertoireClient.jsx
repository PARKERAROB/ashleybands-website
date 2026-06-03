"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const BASE = "/mpa-repertoire-data";

export default function MpaRepertoireClient() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("byyear");
  const [year, setYear] = useState(null);
  const [level, setLevel] = useState("All");
  const [site, setSite] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/byyear.json`).then((r) => r.json()),
      fetch(`${BASE}/aggregate.json`).then((r) => r.json()),
      fetch(`${BASE}/meta.json`).then((r) => r.json())
    ])
      .then(([by, agg, meta]) => {
        setData({ by, agg, meta });
        setYear(meta.years[meta.years.length - 1]);
      })
      .catch(() => setData({ error: true }));
  }, []);

  const yearRows = useMemo(() => {
    if (!data || !data.by) return [];
    return data.by.filter(
      (r) => r.y === year && (level === "All" || r.lv === level) && (site === "All" || r.st === site)
    );
  }, [data, year, level, site]);

  const yearGroups = useMemo(() => {
    const order = [];
    const map = {};
    for (const r of yearRows) {
      if (!map[r.e]) {
        map[r.e] = r;
        order.push(r.e);
      }
    }
    return order.map((e) => ({ ensemble: e, info: map[e], pieces: yearRows.filter((r) => r.e === e) }));
  }, [yearRows]);

  const aggRows = useMemo(() => {
    if (!data || !data.agg) return [];
    const q = query.trim().toLowerCase();
    return data.agg.filter((r) => {
      if (level !== "All" && !(r.lv || "").includes(level)) return false;
      if (!q) return true;
      return r.t.toLowerCase().includes(q) || (r.c || "").toLowerCase().includes(q);
    });
  }, [data, query, level]);

  if (!data) return <main className="mpa-viewer"><section className="mpa-section"><p>Loading repertoire…</p></section></main>;
  if (data.error) return <main className="mpa-viewer"><section className="mpa-section"><p>Could not load data.</p></section></main>;

  const m = data.meta;
  const stats = [
    { label: "Years", value: `${m.years[0]}–${m.years[m.years.length - 1]}`, note: "MPA seasons" },
    { label: "Pieces performed", value: m.rows.toLocaleString(), note: `${m.ensembles.toLocaleString()} ensemble performances` },
    { label: "Unique works", value: m.works.toLocaleString(), note: `${m.repeated} played more than once` },
    { label: "Sites", value: "S · N · ED", note: "South, North, Eastern District" }
  ];

  return (
    <main className="mpa-viewer">
      <section className="mpa-hero">
        <div>
          <p className="eyebrow">Working data view</p>
          <h1>MPA Repertoire — Eastern District</h1>
          <p>
            Every piece performed at NCBA Eastern District MPA, {m.years[0]}–{m.years[m.years.length - 1]},
            listed by year and ranked by how often each work was played. Paired with the{" "}
            <Link href="/mpa-analysis">2026 MPA results analysis</Link>.
          </p>
        </div>
        <aside className="mpa-warning">
          <strong>Working archive</strong>
          <span>
            Built from official MPA programs (2002–2021 district-wide; South + North by site, 2022–2026).
            Central Site repertoire not yet available. Older programs auto-extracted; expect minor noise.
          </span>
        </aside>
      </section>

      <nav className="mpa-tabs" aria-label="MPA repertoire views">
        <button type="button" className={view === "byyear" ? "active" : ""} onClick={() => setView("byyear")}>By year</button>
        <button type="button" className={view === "counts" ? "active" : ""} onClick={() => setView("counts")}>Play counts</button>
      </nav>

      <section className="mpa-section">
        <div className="mpa-stat-grid">
          {stats.map((s) => (
            <div className="mpa-stat" key={s.label}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
              <small>{s.note}</small>
            </div>
          ))}
        </div>
      </section>

      {view === "byyear" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div>
              <h2>Repertoire by Year</h2>
              <p>{yearGroups.length} ensembles in {year}{site !== "All" ? `, ${site}` : ""}{level !== "All" ? `, ${level}` : ""}.</p>
            </div>
            <div className="mpa-filter-row">
              <label className="mpa-filter">Year
                <select value={year || ""} onChange={(e) => setYear(e.target.value)}>
                  {[...m.years].reverse().map((y) => <option key={y}>{y}</option>)}
                </select>
              </label>
              <label className="mpa-filter">Site
                <select value={site} onChange={(e) => setSite(e.target.value)}>
                  <option>All</option>
                  {Object.keys(m.bySite).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="mpa-filter">Level
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option>All</option><option>HS</option><option>MS</option>
                </select>
              </label>
            </div>
          </div>
          {yearGroups.map((grp) => (
            <article key={grp.ensemble} className="mpa-ens-block">
              <h3>{grp.ensemble} <span className="mpa-ens-meta">{grp.info.d ? `— ${grp.info.d} ` : ""}· Grade {grp.info.g || "—"} · {grp.info.st}</span></h3>
              <ul className="mpa-piece-list">
                {grp.pieces.map((p, i) => (
                  <li key={i}>
                    {p.t} <span className="mpa-comp">— {p.c || "Not listed"}</span>
                    {p.p ? <span className="mpa-pill march">March</span> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}

      {view === "counts" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div>
              <h2>Most-Performed Works</h2>
              <p>How many times each piece appeared, {m.years[0]}–{m.years[m.years.length - 1]}. {aggRows.length.toLocaleString()} works shown.</p>
            </div>
            <div className="mpa-filter-row">
              <label className="mpa-filter">Filter
                <input type="search" value={query} placeholder="Title or composer" onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label className="mpa-filter">Level
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option>All</option><option>HS</option><option>MS</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mpa-table-wrap">
            <table className="mpa-table">
              <thead>
                <tr><th>Times played</th><th>Title</th><th>Composer / Arranger</th><th>Span</th></tr>
              </thead>
              <tbody>
                {aggRows.slice(0, 600).map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.n}</strong></td>
                    <td>{r.t}</td>
                    <td className="mpa-comp">{r.c || "Not listed"}</td>
                    <td className="mpa-comp">{r.fy === r.ly ? r.fy : `${r.fy}–${r.ly}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aggRows.length > 600 ? <p className="mpa-comp" style={{ marginTop: 8 }}>Showing top 600. Use the filter to narrow.</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
