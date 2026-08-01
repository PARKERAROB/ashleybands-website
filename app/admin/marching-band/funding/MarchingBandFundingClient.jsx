"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import styles from "./FundingRoster.module.css";

function authHeaders(session) {
  return { "Content-Type": "application/json", "x-staff-id": session.id, "x-staff-token": session.token };
}

function usd(cents) {
  return `$${((Number(cents) || 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function studentName(row) {
  const first = row.preferredFirst || row.legalFirst;
  if (row.legalLast && first) return `${row.legalLast}, ${first}`;
  return row.displayName;
}

function gradeRank(grade) {
  const match = String(grade || "").match(/\d{1,2}/);
  return match ? Number(match[0]) : 99;
}

const alphabetical = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });

function compareStudentNames(a, b) {
  return alphabetical.compare(a.legalLast || "", b.legalLast || "")
    || alphabetical.compare(a.preferredFirst || a.legalFirst || "", b.preferredFirst || b.legalFirst || "")
    || alphabetical.compare(a.displayName || "", b.displayName || "");
}

function instrumentSection(row) {
  return row.instrument || row.role || "Not listed";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadRoster(rows) {
  const header = [
    "student",
    "grade",
    "instrument_or_role",
    "funding_goal",
    "raised",
    "sponsorship",
    "remaining",
    "progress_percent"
  ];
  const body = rows.map((row) => [
    studentName(row),
    row.grade,
    row.role && row.role !== row.instrument ? `${row.instrument} / ${row.role}` : row.instrument,
    (row.goalCents / 100).toFixed(2),
    (row.raisedCents / 100).toFixed(2),
    (row.sponsorshipCents / 100).toFixed(2),
    (row.remainingCents / 100).toFixed(2),
    row.progressPercent ?? ""
  ].map(csvCell).join(","));
  const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `marching-band-funding-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FundingRoster({ session, signOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [sortBy, setSortBy] = useState("instrument");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/marching-band/funding", { headers: authHeaders(session) })
      .then((response) => response.json().catch(() => ({})).then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error || "Could not load the marching band funding roster.");
          return;
        }
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the marching band funding roster.");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const grades = useMemo(
    () => [...new Set((data?.roster || []).map((row) => row.grade).filter(Boolean))].sort((a, b) => gradeRank(a) - gradeRank(b)),
    [data]
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = (data?.roster || []).filter((row) => {
      if (grade && row.grade !== grade) return false;
      if (!term) return true;
      return [studentName(row), row.displayName, row.grade, row.instrument, row.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "instrument") {
        return alphabetical.compare(instrumentSection(a), instrumentSection(b)) || compareStudentNames(a, b);
      }
      if (sortBy === "grade") return gradeRank(a.grade) - gradeRank(b.grade) || compareStudentNames(a, b);
      if (sortBy === "raised") return b.raisedCents - a.raisedCents || compareStudentNames(a, b);
      if (sortBy === "remaining") return b.remainingCents - a.remainingCents || compareStudentNames(a, b);
      return compareStudentNames(a, b);
    });
  }, [data, grade, query, sortBy]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}>← Staff dashboards</Link>
          <h1>Marching Band roster and funding</h1>
          <p>Current 2026 marching students, their placement, and progress toward the season funding goal.</p>
        </div>
        <div className={styles.account}>
          <span>Signed in as <strong>{session.display_name}</strong></span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {!data && !error ? <div className={styles.loading} aria-label="Loading roster"><span /><span /><span /></div> : null}

      {data ? (
        <>
          <p className={styles.summary}>
            <strong>{data.totals.students} students</strong>
            <span>{usd(data.totals.raisedCents)} raised of {usd(data.totals.goalCents)}</span>
            <span>{usd(data.totals.remainingCents)} remaining</span>
            <span>{usd(data.totals.sponsorshipCents)} from sponsorships</span>
            <span>{data.totals.goalMet} goals met</span>
            {data.totals.withoutGoal ? <span className={styles.warning}>{data.totals.withoutGoal} without a goal</span> : null}
          </p>

          <div className={styles.toolbar}>
            <label>
              <span>Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Student or instrument"
              />
            </label>
            <label>
              <span>Grade</span>
              <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                <option value="">All grades</option>
                {grades.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="instrument">Instrument section, then last name</option>
                <option value="name">Last name</option>
                <option value="grade">Grade</option>
                <option value="raised">Amount raised</option>
                <option value="remaining">Amount remaining</option>
              </select>
            </label>
            <button type="button" className={styles.download} onClick={() => downloadRoster(rows)}>
              Download CSV
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Grade</th>
                  <th>Instrument / role</th>
                  <th className={styles.money}>Goal</th>
                  <th className={styles.money}>Raised</th>
                  <th className={styles.money}>Remaining</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const progressValue = row.goalCents > 0 ? Math.min(row.raisedCents, row.goalCents) : 0;
                  return (
                    <tr key={row.id}>
                      <th scope="row">{studentName(row)}</th>
                      <td>{row.grade || "Not listed"}</td>
                      <td>
                        {row.instrument || "Not listed"}
                        {row.role && row.role !== row.instrument ? <span className={styles.role}>{row.role}</span> : null}
                      </td>
                      <td className={styles.money}>{row.goalCents ? usd(row.goalCents) : "Not set"}</td>
                      <td className={`${styles.money} ${styles.raised}`}>{usd(row.raisedCents)}</td>
                      <td className={styles.money}>{row.goalCents ? usd(row.remainingCents) : "—"}</td>
                      <td>
                        {row.goalCents ? (
                          <div className={styles.progress}>
                            <progress max={row.goalCents} value={progressValue} aria-label={`${studentName(row)} funding progress`} />
                            <span>{row.progressPercent}%</span>
                          </div>
                        ) : <span className={styles.muted}>No goal</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p className={styles.empty}>No marching students match these filters.</p> : null}
          <p className={styles.footnote}>
            Showing {rows.length} of {data.totals.students} students marked “Yes” for Marching Band in the current roster.
            Completed marching-band payments and sponsorships count toward amount raised.
          </p>
        </>
      ) : null}
    </main>
  );
}

export default function MarchingBandFundingClient() {
  return (
    <StaffGate>
      {(session, signOut) => <FundingRoster session={session} signOut={signOut} />}
    </StaffGate>
  );
}
