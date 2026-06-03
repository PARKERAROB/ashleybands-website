"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const summaryStats = [
  { label: "Total entries", value: "594", note: "All statewide CSV rows" },
  { label: "Rated entries", value: "565", note: "Excludes Comments Only" },
  { label: "Comments Only", value: "29", note: "More common at middle school" },
  { label: "Superior or Excellent", value: "85.5%", note: "Rated entries only" }
];

const overallRatings = [
  { rating: "Superior", count: 308, percent: "54.5%" },
  { rating: "Excellent", count: 175, percent: "31.0%" },
  { rating: "Average", count: 63, percent: "11.2%" },
  { rating: "Below Average", count: 19, percent: "3.4%" }
];

const levelRatings = [
  { level: "High School", superior: 202, excellent: 91, average: 26, belowAverage: 6, total: 325, superiorRate: "62.2%" },
  { level: "Middle School", superior: 106, excellent: 84, average: 37, belowAverage: 13, total: 240, superiorRate: "44.2%" }
];

const gradeDistribution = [
  { grade: "I", hs: 4, ms: 66, total: 70, hsPercent: "5.7%", msPercent: "94.3%" },
  { grade: "II", hs: 26, ms: 147, total: 173, hsPercent: "15.0%", msPercent: "85.0%" },
  { grade: "III", hs: 109, ms: 37, total: 146, hsPercent: "74.7%", msPercent: "25.3%" },
  { grade: "IV", hs: 96, ms: 4, total: 100, hsPercent: "96.0%", msPercent: "4.0%" },
  { grade: "V", hs: 53, ms: 1, total: 54, hsPercent: "98.1%", msPercent: "1.9%" },
  { grade: "VI", hs: 46, ms: 0, total: 46, hsPercent: "100.0%", msPercent: "0.0%" }
];

const gradeSuperiorRates = [
  { level: "Middle School", grade: "I", rated: 57, superiors: 15, rate: "26.3%" },
  { level: "Middle School", grade: "II", rated: 141, superiors: 60, rate: "42.6%" },
  { level: "Middle School", grade: "III", rated: 37, superiors: 26, rate: "70.3%" },
  { level: "Middle School", grade: "IV", rated: 4, superiors: 4, rate: "100.0%" },
  { level: "Middle School", grade: "V", rated: 1, superiors: 1, rate: "100.0%" },
  { level: "High School", grade: "I", rated: 3, superiors: 0, rate: "0.0%" },
  { level: "High School", grade: "II", rated: 24, superiors: 6, rate: "25.0%" },
  { level: "High School", grade: "III", rated: 106, superiors: 61, rate: "57.5%" },
  { level: "High School", grade: "IV", rated: 93, superiors: 60, rate: "64.5%" },
  { level: "High School", grade: "V", rated: 53, superiors: 37, rate: "69.8%" },
  { level: "High School", grade: "VI", rated: 46, superiors: 38, rate: "82.6%" }
];

const singleMultiPerformance = [
  { level: "HS", type: "Single-ensemble", entries: 168, schools: 168, superiors: 93, superiorRate: "55.4%", avgRating: "1.61", avgGrade: "3.59" },
  { level: "HS", type: "Multi-ensemble", entries: 157, schools: 73, superiors: 109, superiorRate: "69.4%", avgRating: "1.37", avgGrade: "4.32" },
  { level: "MS", type: "Single-ensemble", entries: 142, schools: 142, superiors: 53, superiorRate: "37.3%", avgRating: "2.01", avgGrade: "1.88" },
  { level: "MS", type: "Multi-ensemble", entries: 98, schools: 50, superiors: 53, superiorRate: "54.1%", avgRating: "1.55", avgGrade: "2.08" }
];

const hsProgramRoles = [
  { role: "Single only ensemble", entries: 168, schools: 168, avgGrade: "3.59", superiors: 93, superiorRate: "55.4%", avgRating: "1.61" },
  { role: "Multi lower/secondary ensemble", entries: 84, schools: 72, avgGrade: "3.45", superiors: 52, superiorRate: "61.9%", avgRating: "1.46" },
  { role: "Multi highest-level ensemble", entries: 73, schools: 71, avgGrade: "5.33", superiors: 57, superiorRate: "78.1%", avgRating: "1.26" }
];

const districtBreakdown = [
  { district: "East Central", rated: 73, superiors: 47, superiorRate: "64.4%", avgRating: "1.49", avgGrade: "3.60" },
  { district: "Northwest", rated: 86, superiors: 54, superiorRate: "62.8%", avgRating: "1.52", avgGrade: "3.10" },
  { district: "Western", rated: 53, superiors: 30, superiorRate: "56.6%", avgRating: "1.62", avgGrade: "3.06" },
  { district: "South Central", rated: 119, superiors: 67, superiorRate: "56.3%", avgRating: "1.54", avgGrade: "2.97" },
  { district: "Central", rated: 71, superiors: 38, superiorRate: "53.5%", avgRating: "1.59", avgGrade: "3.03" },
  { district: "Eastern", rated: 101, superiors: 51, superiorRate: "50.5%", avgRating: "1.65", avgGrade: "3.11" },
  { district: "Southeastern", rated: 62, superiors: 21, superiorRate: "33.9%", avgRating: "2.16", avgGrade: "2.89" }
];

const gradeContext = [
  { context: "MS Grade III", meaning: "Upper-level middle school work" },
  { context: "HS Grade III, only ensemble", meaning: "Possibly full 9-12 program, likely with program constraints" },
  { context: "HS Grade III, multi-ensemble school", meaning: "Usually a lower/developmental/younger ensemble" },
  { context: "HS Grade III, highest group at school", meaning: "Likely a developing high school program" }
];

const sections = {
  overview: "Overview",
  grades: "Grade Context",
  programs: "Program Structure",
  districts: "Districts",
  conclusions: "Discussion Points"
};

function DataTable({ columns, rows }) {
  return (
    <div className="mpa-table-wrap">
      <table className="mpa-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `${row[columns[0].key]}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bar({ label, value, max, tone = "garnet" }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mpa-bar-row">
      <div className="mpa-bar-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="mpa-bar-track">
        <span className={`mpa-bar-fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function MpaAnalysisClient() {
  const [activeSection, setActiveSection] = useState("overview");
  const [levelFilter, setLevelFilter] = useState("All");

  const filteredGradeRates = useMemo(() => {
    if (levelFilter === "All") return gradeSuperiorRates;
    return gradeSuperiorRates.filter((row) => row.level === levelFilter);
  }, [levelFilter]);

  return (
    <main className="mpa-viewer">
      <section className="mpa-hero">
        <div>
          <p className="eyebrow">Working data view</p>
          <h1>2026 NC MPA Results Analysis</h1>
          <p>
            Aggregated statewide discussion notes for interpreting MPA data by level, grade,
            district, and program structure. See also the{" "}
            <Link href="/mpa-repertoire">South Site repertoire archive</Link>.
          </p>
        </div>
        <aside className="mpa-warning">
          <strong>Working report</strong>
          <span>
            Raw and uncleaned. Use for support conversations only. Do not use as a ranking report.
          </span>
        </aside>
      </section>

      <nav className="mpa-tabs" aria-label="MPA analysis sections">
        {Object.entries(sections).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={activeSection === key ? "active" : ""}
            onClick={() => setActiveSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeSection === "overview" ? (
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

          <div className="mpa-two-col">
            <article>
              <h2>Overall Ratings</h2>
              <DataTable
                columns={[
                  { key: "rating", label: "Rating" },
                  { key: "count", label: "Count" },
                  { key: "percent", label: "Percent" }
                ]}
                rows={overallRatings}
              />
            </article>
            <article>
              <h2>Ratings by Level</h2>
              <DataTable
                columns={[
                  { key: "level", label: "Level" },
                  { key: "total", label: "Rated" },
                  { key: "superior", label: "Superior" },
                  { key: "superiorRate", label: "Superior Rate" },
                  { key: "belowAverage", label: "Below Avg" }
                ]}
                rows={levelRatings}
              />
            </article>
          </div>
        </section>
      ) : null}

      {activeSection === "grades" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div>
              <h2>Grade Distribution and Superior Rates</h2>
              <p>Grade III is the crossover grade. Grade IV appears closer to the high school center.</p>
            </div>
            <label className="mpa-filter">
              Level
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                <option>All</option>
                <option>High School</option>
                <option>Middle School</option>
              </select>
            </label>
          </div>

          <div className="mpa-two-col">
            <article>
              <h3>Entries by Grade</h3>
              {gradeDistribution.map((row) => (
                <Bar key={row.grade} label={`Grade ${row.grade}`} value={row.total} max={173} />
              ))}
            </article>
            <article>
              <h3>Who Plays Each Grade?</h3>
              <DataTable
                columns={[
                  { key: "grade", label: "Grade" },
                  { key: "hsPercent", label: "HS" },
                  { key: "msPercent", label: "MS" },
                  { key: "total", label: "Total" }
                ]}
                rows={gradeDistribution}
              />
            </article>
          </div>

          <DataTable
            columns={[
              { key: "level", label: "Level" },
              { key: "grade", label: "Grade" },
              { key: "rated", label: "Rated" },
              { key: "superiors", label: "Superiors" },
              { key: "rate", label: "Superior Rate" }
            ]}
            rows={filteredGradeRates}
          />
        </section>
      ) : null}

      {activeSection === "programs" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div>
              <h2>Program Structure</h2>
              <p>
                Single-ensemble and multi-ensemble entries can look similar on paper while
                representing different program realities.
              </p>
            </div>
          </div>
          <div className="mpa-callout-grid">
            <div className="mpa-callout">
              <span>Grade VI HS entries</span>
              <strong>39 of 46</strong>
              <p>came from multi-ensemble high schools.</p>
            </div>
            <div className="mpa-callout">
              <span>HS Grade III in multi schools</span>
              <strong>92.7%</strong>
              <p>were lower or secondary ensembles, not the highest-level group.</p>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "level", label: "Level" },
              { key: "type", label: "School Type" },
              { key: "entries", label: "Entries" },
              { key: "schools", label: "Schools" },
              { key: "superiorRate", label: "Superior Rate" },
              { key: "avgGrade", label: "Avg Grade" },
              { key: "avgRating", label: "Avg Rating" }
            ]}
            rows={singleMultiPerformance}
          />
          <h3>High School Program Role Summary</h3>
          <DataTable
            columns={[
              { key: "role", label: "Program Role" },
              { key: "entries", label: "Entries" },
              { key: "schools", label: "Schools" },
              { key: "avgGrade", label: "Avg Grade" },
              { key: "superiorRate", label: "Superior Rate" },
              { key: "avgRating", label: "Avg Rating" }
            ]}
            rows={hsProgramRoles}
          />
        </section>
      ) : null}

      {activeSection === "districts" ? (
        <section className="mpa-section">
          <div className="mpa-section-head">
            <div>
              <h2>District-Level Breakdown</h2>
              <p>
                District numbers should prompt questions about support conditions, not assumptions
                about teaching quality.
              </p>
            </div>
          </div>
          <div className="mpa-bars">
            {districtBreakdown.map((row) => (
              <Bar key={row.district} label={row.district} value={Number(row.superiorRate.replace("%", ""))} max={70} tone="blue" />
            ))}
          </div>
          <DataTable
            columns={[
              { key: "district", label: "District" },
              { key: "rated", label: "Rated" },
              { key: "superiors", label: "Superiors" },
              { key: "superiorRate", label: "Superior Rate" },
              { key: "avgRating", label: "Avg Rating" },
              { key: "avgGrade", label: "Avg Grade" }
            ]}
            rows={districtBreakdown}
          />
        </section>
      ) : null}

      {activeSection === "conclusions" ? (
        <section className="mpa-section">
          <div className="mpa-two-col">
            <article>
              <h2>Grade III Is Not One Thing</h2>
              <DataTable
                columns={[
                  { key: "context", label: "Context" },
                  { key: "meaning", label: "Likely Interpretation" }
                ]}
                rows={gradeContext}
              />
            </article>
            <article className="mpa-discussion">
              <h2>Support Questions</h2>
              <ul>
                <li>Where do lower-grade high school entries point to support needs?</li>
                <li>Where would repertoire selection mentoring help?</li>
                <li>Which programs need feeder alignment or retention support?</li>
                <li>Where does Comments Only help programs enter the assessment process?</li>
                <li>What does this program need next?</li>
              </ul>
            </article>
          </div>
          <div className="mpa-final-note">
            <strong>Strongest takeaway</strong>
            <p>
              MPA data should help us ask, &quot;What does this program need next?&quot; rather than simply,
              &quot;How good is this band?&quot;
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
