"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { meta, byYear, aggregate } from "./mpaRepertoireData";

const summaryStats = [
  { label: "Years", value: `${meta.years[0]}–${meta.years[meta.years.length - 1]}`, note: "South Site MPA" },
  { label: "Ensemble performances", value: String(meta.ensembleCount), note: "Across all years" },
  { label: "Pieces performed", value: String(meta.pieceRows), note: "Marches + selections" },
  { label: "Unique works", value: String(meta.uniqueWorks), note: `${meta.repeated} played more than once` }
];

function PieceTag({ type }) {
  if (type === "March") return <span className="mpa-pill march">March</span>;
  return <span className="mpa-pill">Selection</span>;
}

export default function MpaRepertoireClient() {
  const [activeView, setActiveView] = useState("byyear");
  const [query, setQuery] = useState("");

  const piecesByYear = useMemo(() => {
    const groups = {};
    for (const row of byYear) {
      (groups[row.year] ||= []).push(row);
    }
    return groups;
  }, []);

  const years = useMemo(() => [...meta.years].sort((a, b) => Number(b) - Number(a)), []);

  const filteredAggregate = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return aggregate;
    return aggregate.filter(
      (row) => row.title.toLowerCase().includes(q) || row.composer.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <main className="mpa-viewer">
      <section className="mpa-hero">
        <div>
          <p className="eyebrow">Working data view</p>
          <h1>MPA Repertoire — South Site</h1>
          <p>
            Every piece performed at the NCBA Eastern District MPA South Site, {meta.years[0]}–
            {meta.years[meta.years.length - 1]}, listed by year and ranked by how often each work
            was played. Paired with the{" "}
            <Link href="/mpa-analysis">2026 MPA results analysis</Link>.
          </p>
        </div>
        <aside className="mpa-warning">
          <strong>Working archive</strong>
          <span>
            Built from official MPA programs. South Site only for now; North, Central, and
            2002–2019 are being added.
          </span>
        </aside>
      </section>

      <nav className="mpa-tabs" aria-label="MPA repertoire views">
        <button
          type="button"
          className={activeView === "byyear" ? "active" : ""}
          onClick={() => setActiveView("byyear")}
        >
          By year
        </button>
        <button
          type="button"
          className={activeView === "counts" ? "active" : ""}
          onClick={() => setActiveView("counts")}
        >
          Play counts
        </button>
      </nav>

      <section className="mpa-section">
        <div className="mpa-stat-grid">
          {summaryStats.map((stat) => (
            <div className="mpa-stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
          ))}
        </div>
      </section>

      {activeView === "byyear" ? (
        <section className="mpa-section">
          {years.map((year) => (
            <article key={year} className="mpa-year-block">
              <h2>{year}</h2>
              <div className="mpa-table-wrap">
                <table className="mpa-table">
                  <thead>
                    <tr>
                      <th>Ensemble</th>
                      <th>Director</th>
                      <th>Grade</th>
                      <th>Title</th>
                      <th>Composer / Arranger</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piecesByYear[year].map((row, index) => (
                      <tr key={`${year}-${row.ensemble}-${row.title}-${index}`}>
                        <td>{row.ensemble}</td>
                        <td>{row.director}</td>
                        <td>{row.grade}</td>
                        <td>
                          <strong>{row.title}</strong>
                        </td>
                        <td>{row.composer || "Not listed"}</td>
                        <td>
                          <PieceTag type={row.type} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {activeView === "counts" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div>
              <h2>Most-Performed Works</h2>
              <p>How many times each piece appeared across {meta.years[0]}–{meta.years[meta.years.length - 1]}.</p>
            </div>
            <label className="mpa-filter">
              Filter
              <input
                type="search"
                value={query}
                placeholder="Title or composer"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="mpa-table-wrap">
            <table className="mpa-table">
              <thead>
                <tr>
                  <th>Times played</th>
                  <th>Title</th>
                  <th>Composer / Arranger</th>
                  <th>Years</th>
                </tr>
              </thead>
              <tbody>
                {filteredAggregate.map((row, index) => (
                  <tr key={`${row.title}-${index}`}>
                    <td>
                      <strong>{row.count}</strong>
                    </td>
                    <td>{row.title}</td>
                    <td>{row.composer || "Not listed"}</td>
                    <td>{row.years}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
