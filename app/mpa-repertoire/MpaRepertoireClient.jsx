"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const BASE = "/mpa-repertoire-data";
const GRADES = ["I", "II", "III", "IV", "V", "VI"];

function rate(a) {
  return a.rn > 0 ? Math.round((100 * (a.su + a.ex)) / a.rn) : null;
}

export default function MpaRepertoireClient() {
  const [data, setData] = useState(null);
  const [view, setView] = useState("grade");
  const [grade, setGrade] = useState("III");
  const [district, setDistrict] = useState("All");
  const [site, setSite] = useState("All");
  const [level, setLevel] = useState("All");
  const [year, setYear] = useState(null);
  const [q, setQ] = useState("");
  const [countSort, setCountSort] = useState("plays");
  const [ratingSort, setRatingSort] = useState("high");
  const [minRated, setMinRated] = useState(1);

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

  const ql = q.trim().toLowerCase();
  const matchTC = (a) => !ql || a.t.toLowerCase().includes(ql) || (a.c || "").toLowerCase().includes(ql);

  // Play counts (aggregate)
  const counts = useMemo(() => {
    if (!data) return [];
    let rows = data.agg.filter((a) => {
      if (grade !== "All" && (a.mg || "").split("/")[0] !== grade) return false;
      if (level !== "All" && !(a.lv || "").includes(level)) return false;
      return matchTC(a);
    });
    rows = [...rows];
    if (countSort === "plays") rows.sort((x, y) => y.n - x.n);
    else if (countSort === "title") rows.sort((x, y) => x.t.localeCompare(y.t));
    else if (countSort === "recent") rows.sort((x, y) => y.ly.localeCompare(x.ly));
    return rows;
  }, [data, grade, level, ql, countSort]);

  // By grade (Step 1)
  const byGrade = useMemo(() => {
    if (!data) return [];
    return data.agg
      .filter((a) => (a.mg || "").split("/")[0] === grade && (level === "All" || (a.lv || "").includes(level)) && matchTC(a))
      .sort((x, y) => y.n - x.n);
  }, [data, grade, level, ql]);

  // Ratings (Step 2)
  const ratings = useMemo(() => {
    if (!data) return [];
    let rows = data.agg.filter((a) => a.rn >= minRated && (grade === "All" || (a.mg || "").split("/")[0] === grade) && (level === "All" || (a.lv || "").includes(level)) && matchTC(a));
    rows = [...rows];
    if (ratingSort === "high") rows.sort((x, y) => (rate(y) - rate(x)) || y.rn - x.rn);
    else if (ratingSort === "low") rows.sort((x, y) => (rate(x) - rate(y)) || y.rn - x.rn);
    else rows.sort((x, y) => y.rn - x.rn);
    return rows;
  }, [data, minRated, grade, level, ql, ratingSort]);

  // By year
  const yearRows = useMemo(() => {
    if (!data) return [];
    return data.by.filter((r) =>
      r.y === year &&
      (district === "All" || r.dist === district) &&
      (site === "All" || r.st === site) &&
      (level === "All" || r.lv === level) &&
      (!ql || r.e.toLowerCase().includes(ql) || r.t.toLowerCase().includes(ql) || (r.c || "").toLowerCase().includes(ql) || (r.d || "").toLowerCase().includes(ql))
    );
  }, [data, year, district, site, level, ql]);

  const yearGroups = useMemo(() => {
    const order = []; const map = {};
    for (const r of yearRows) { if (!map[r.e]) { map[r.e] = r; order.push(r.e); } }
    return order.map((e) => ({ ensemble: e, info: map[e], pieces: yearRows.filter((r) => r.e === e) }));
  }, [yearRows]);

  if (!data) return <main className="mpa-viewer"><section className="mpa-section"><p>Loading repertoire…</p></section></main>;
  if (data.error) return <main className="mpa-viewer"><section className="mpa-section"><p>Could not load data.</p></section></main>;
  const m = data.meta;

  const GradeSel = ({ all }) => (
    <label className="mpa-filter">Grade
      <select value={grade} onChange={(e) => setGrade(e.target.value)}>
        {all ? <option>All</option> : null}
        {GRADES.map((g) => <option key={g}>{g}</option>)}
      </select>
    </label>
  );
  const LevelSel = () => (
    <label className="mpa-filter">Level
      <select value={level} onChange={(e) => setLevel(e.target.value)}><option>All</option><option>HS</option><option>MS</option></select>
    </label>
  );
  const DistrictSel = () => (
    <label className="mpa-filter">District
      <select value={district} onChange={(e) => setDistrict(e.target.value)}>
        <option>All</option>{Object.keys(m.byDistrict).map((d) => <option key={d}>{d}</option>)}
      </select>
    </label>
  );
  const Search = ({ ph }) => (
    <label className="mpa-filter">Search
      <input type="search" value={q} placeholder={ph} onChange={(e) => setQ(e.target.value)} />
    </label>
  );

  return (
    <main className="mpa-viewer">
      <section className="mpa-hero">
        <div>
          <p className="eyebrow">Working data view</p>
          <h1>MPA Repertoire — Eastern District</h1>
          <p>
            {m.rows.toLocaleString()} pieces performed, {m.years[0]}–{m.years[m.years.length - 1]} ·{" "}
            {m.works.toLocaleString()} unique works. Grades use the current NCBA MPA list. Paired with the{" "}
            <Link href="/mpa-analysis">2026 MPA results analysis</Link>.
          </p>
        </div>
        <aside className="mpa-warning">
          <strong>Working archive</strong>
          <span>
            Repertoire from official MPA programs (2002–2026). Grade = current NCBA MPA list ({m.graded} works matched).
            Ratings currently {m.ratingYears.join(", ")} only ({m.rated} works); they grow as past years are added.
            Other NCBA districts can be added later.
          </span>
        </aside>
      </section>

      <nav className="mpa-tabs" aria-label="views">
        <button type="button" className={view === "grade" ? "active" : ""} onClick={() => setView("grade")}>By grade</button>
        <button type="button" className={view === "counts" ? "active" : ""} onClick={() => setView("counts")}>Play counts</button>
        <button type="button" className={view === "ratings" ? "active" : ""} onClick={() => setView("ratings")}>Ratings</button>
        <button type="button" className={view === "byyear" ? "active" : ""} onClick={() => setView("byyear")}>By year</button>
      </nav>

      {view === "grade" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div><h2>Most-Performed Works — Grade {grade}</h2><p>{byGrade.length} works at this grade (current MPA list). Ranked by how often they were performed.</p></div>
            <div className="mpa-filter-row"><GradeSel /><LevelSel /><Search ph="Title or composer" /></div>
          </div>
          <div className="mpa-table-wrap">
            <table className="mpa-table"><thead><tr><th>Times played</th><th>Title</th><th>Composer / Arranger</th><th>Level</th><th>Span</th></tr></thead>
              <tbody>{byGrade.slice(0, 400).map((a, i) => (
                <tr key={i}><td><strong>{a.n}</strong></td><td>{a.t}</td><td className="mpa-comp">{a.c || "Not listed"}</td><td className="mpa-comp">{a.lv}</td><td className="mpa-comp">{a.fy === a.ly ? a.fy : `${a.fy}–${a.ly}`}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === "counts" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div><h2>All Works by Play Count</h2><p>{counts.length.toLocaleString()} works.</p></div>
            <div className="mpa-filter-row">
              <GradeSel all /><LevelSel /><Search ph="Title or composer" />
              <label className="mpa-filter">Sort
                <select value={countSort} onChange={(e) => setCountSort(e.target.value)}><option value="plays">Most played</option><option value="title">Title A–Z</option><option value="recent">Most recent</option></select>
              </label>
            </div>
          </div>
          <div className="mpa-table-wrap">
            <table className="mpa-table"><thead><tr><th>Times</th><th>Title</th><th>Composer / Arranger</th><th>Grade</th><th>Level</th><th>Span</th></tr></thead>
              <tbody>{counts.slice(0, 700).map((a, i) => (
                <tr key={i}><td><strong>{a.n}</strong></td><td>{a.t}</td><td className="mpa-comp">{a.c || "Not listed"}</td><td>{a.mg ? <span className="mpa-pill grade">{a.mg}</span> : <span className="mpa-comp">—</span>}</td><td className="mpa-comp">{a.lv}</td><td className="mpa-comp">{a.fy === a.ly ? a.fy : `${a.fy}–${a.ly}`}</td></tr>
              ))}</tbody>
            </table>
            {counts.length > 700 ? <p className="mpa-comp" style={{ marginTop: 8 }}>Showing first 700 — narrow with filters.</p> : null}
          </div>
        </section>
      ) : null}

      {view === "ratings" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div><h2>Success by Piece (Superior / Excellent)</h2><p>Share of rated performances that earned Superior or Excellent. {ratings.length} works with at least {minRated} rated performance{minRated > 1 ? "s" : ""}. Ratings = {m.ratingYears.join(", ")} so far.</p></div>
            <div className="mpa-filter-row">
              <label className="mpa-filter">Sort
                <select value={ratingSort} onChange={(e) => setRatingSort(e.target.value)}><option value="high">Highest Sup/Ex</option><option value="low">Lowest Sup/Ex</option><option value="most">Most rated</option></select>
              </label>
              <label className="mpa-filter">Min rated
                <select value={minRated} onChange={(e) => setMinRated(Number(e.target.value))}><option value={1}>1+</option><option value={2}>2+</option><option value={3}>3+</option></select>
              </label>
              <GradeSel all /><LevelSel /><Search ph="Title or composer" />
            </div>
          </div>
          <div className="mpa-table-wrap">
            <table className="mpa-table"><thead><tr><th>Sup/Ex</th><th>Title</th><th>Grade</th><th>Rated</th><th>Superior</th><th>Excellent</th><th>Plays</th></tr></thead>
              <tbody>{ratings.slice(0, 500).map((a, i) => {
                const rt = rate(a);
                const tone = rt >= 80 ? "good" : rt >= 50 ? "mid" : "low";
                return (<tr key={i}><td><span className={`mpa-rate ${tone}`}>{rt}%</span></td><td>{a.t}</td><td>{a.mg ? <span className="mpa-pill grade">{a.mg}</span> : <span className="mpa-comp">—</span>}</td><td>{a.rn}</td><td>{a.su}</td><td>{a.ex}</td><td className="mpa-comp">{a.n}</td></tr>);
              })}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === "byyear" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div><h2>Repertoire by Year</h2><p>{yearGroups.length} ensembles in {year}.</p></div>
            <div className="mpa-filter-row">
              <label className="mpa-filter">Year<select value={year || ""} onChange={(e) => setYear(e.target.value)}>{[...m.years].reverse().map((y) => <option key={y}>{y}</option>)}</select></label>
              <DistrictSel />
              <label className="mpa-filter">Site<select value={site} onChange={(e) => setSite(e.target.value)}><option>All</option>{Object.keys(m.bySite).map((s) => <option key={s}>{s}</option>)}</select></label>
              <LevelSel /><Search ph="School, title, composer" />
            </div>
          </div>
          {yearGroups.map((grp) => (
            <article key={grp.ensemble} className="mpa-ens-block">
              <h3>{grp.ensemble} <span className="mpa-ens-meta">{grp.info.d ? `— ${grp.info.d} ` : ""}· Grade {grp.info.pg || "—"} · {grp.info.st}{grp.info.r ? ` · ${grp.info.r}` : ""}</span></h3>
              <ul className="mpa-piece-list">
                {grp.pieces.map((p, i) => (
                  <li key={i}>{p.t} <span className="mpa-comp">— {p.c || "Not listed"}</span>{p.mg ? <span className="mpa-pill grade">Gr {p.mg}</span> : null}{p.p ? <span className="mpa-pill march">March</span> : null}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
