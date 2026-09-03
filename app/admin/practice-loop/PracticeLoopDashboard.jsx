"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import {
  aggregatePracticeRanges,
  DEFAULT_PRACTICE_PIECE_SLUG,
  getPracticePiece,
  PRACTICE_PIECE_LIST,
  practiceRanges,
  rankPracticeRanges,
} from "@/lib/practiceLoop.mjs";
import styles from "./practice-loop-dashboard.module.css";

const LABELS = { red: "Not yet", yellow: "Working", green: "Ready" };

export default function PracticeLoopDashboard() {
  return <StaffGate>{(session, signOut) => <Dashboard session={session} signOut={signOut} />}</StaffGate>;
}

function Dashboard({ session, signOut }) {
  const [pieceSlug, setPieceSlug] = useState(DEFAULT_PRACTICE_PIECE_SLUG);
  const piece = getPracticePiece(pieceSlug);
  const ranges = practiceRanges(piece);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setSubmissions([]);
    setError("");
    try {
      const response = await fetch(`/api/admin/practice-loop?piece=${encodeURIComponent(pieceSlug)}`, {
        headers: staffAuthHeaders(session),
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        await signOut();
        return;
      }
      if (!response.ok) throw new Error(body.error || "The dashboard could not be loaded.");
      setSubmissions(body.submissions || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [pieceSlug, session, signOut]);

  const changeStudent = async (submission, action) => {
    if (action === "remove" && !window.confirm(`Remove ${submission.display_name} from this dashboard?`)) return;
    setSavingId(submission.id);
    setError("");
    try {
      const response = await fetch("/api/admin/practice-loop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...staffAuthHeaders(session) },
        body: JSON.stringify({
          action,
          pieceSlug,
          submissionId: submission.id,
          displayName: action === "rename" ? editingName : undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        await signOut();
        return;
      }
      if (!response.ok) throw new Error(body.error || "That student change could not be completed.");
      setEditingId("");
      setEditingName("");
      await load();
    } catch (changeError) {
      setError(changeError.message);
    } finally {
      setSavingId("");
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(loadTimer);
  }, [load]);

  const markCount = submissions.reduce((sum, submission) => sum + Object.keys(submission.marks || {}).length, 0);
  const aggregateRanges = aggregatePracticeRanges(submissions, ranges);
  const rankedRanges = rankPracticeRanges(aggregateRanges);
  const movementAware = piece.movements.length > 1;
  const rangeMarker = (range) => range.rehearsalLabel || (movementAware ? range.rangePrefix : "");
  const rangeLabel = (range) => `${rangeMarker(range) ? `${rangeMarker(range)} · ` : ""}mm. ${range.start}–${range.end}`;
  const rangeTitle = (range) => `${range.rehearsalLabel ? `Rehearsal mark ${range.rehearsalLabel}, ` : movementAware ? `${piece.sectionLabel || "Movement"} ${range.movementNumber}. ${range.movementTitle}, ` : ""}measures ${range.start}–${range.end}`;
  const tableRangeLabel = (range) => range.rehearsalLabel || (movementAware ? `${range.rangePrefix}·${range.start}` : range.start);
  const movementStartsHere = (range) => movementAware && range.movementIndex > 0
    && range.start === piece.movements[range.movementIndex].rehearsalStarts[0];

  const heatBand = (range) => {
    if (range.concernPercent == null) return "unassessed";
    if (range.concernPercent >= 67) return "high";
    if (range.concernPercent >= 34) return "medium";
    return "low";
  };

  return <main className={styles.page}>
    <header className={styles.appBar}>
      <div><strong>Ashley Bands</strong><span>Practice Loop prototype</span></div>
      <div><span>{session.display_name}</span><button type="button" onClick={signOut}>Sign out</button></div>
    </header>
    <section className={styles.heading}>
      <div><p>Current student self-assessment</p><h1><em>{piece.title}</em></h1><span>{piece.shortCredit}</span></div>
      <div className={styles.headingActions}>
        <label>Piece<select value={pieceSlug} onChange={(event) => {
          setEditingId("");
          setEditingName("");
          setPieceSlug(event.target.value);
        }}>
          {PRACTICE_PIECE_LIST.map((option) => <option value={option.slug} key={option.slug}>{option.title}</option>)}
        </select></label>
        <button type="button" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
    </section>
    <section className={styles.metrics}>
      <div><strong>{submissions.length}</strong><span>students</span></div>
      <div><strong>{markCount}</strong><span>current marks</span></div>
      <div><strong>{ranges.length}</strong><span>rehearsal ranges</span></div>
    </section>
    <div className={styles.legend}><span data-status="red">Not yet</span><span data-status="yellow">Working</span><span data-status="green">Ready</span><span>— Unmarked</span></div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!loading && !error && !submissions.length ? <section className={styles.empty}><h2>No student marks yet</h2><p>Keep this page open and refresh after students begin using the prototype.</p></section> : null}
    {!loading && !error && submissions.length ? <section className={styles.aggregate} aria-labelledby="ensemble-snapshot-heading">
      <div className={styles.aggregateHeading}>
        <div><p>Ensemble aggregate</p><h2 id="ensemble-snapshot-heading">Reported rehearsal needs</h2></div>
        <p>Concern = Not yet weighted twice plus Working, divided by marked responses. Unmarked responses are shown but not scored.</p>
      </div>
      <div className={styles.aggregateLayout}>
        <div>
          <h3>Priority order</h3>
          <ol className={styles.priorityList}>
            {rankedRanges.map((range) => <li key={range.id} data-unassessed={range.concernPercent == null || undefined}>
              <span className={styles.rankRange}>{rangeLabel(range)}</span>
              <strong>{range.concernPercent == null ? "Unassessed" : `${range.concernPercent}% concern`}</strong>
              <span>{range.responseCount} marked · {range.unmarked} unmarked</span>
            </li>)}
          </ol>
        </div>
        <div>
          <h3>All ranges in musical order</h3>
          <div className={styles.heatMap}>
            {aggregateRanges.map((range) => <article key={range.id} data-heat={heatBand(range)} data-large-change={range.largeChange || undefined} data-movement-start={movementStartsHere(range) || undefined} title={`${rangeTitle(range)}: ${range.red} Not yet, ${range.yellow} Working, ${range.green} Ready, ${range.unmarked} unmarked`}>
              <span>{rangeLabel(range)}</span>
              <strong>{range.concernPercent == null ? "—" : `${range.concernPercent}%`}</strong>
              <small>{range.red}R · {range.yellow}W · {range.green} ready</small>
              <small>{range.responseCount} marked · {range.unmarked} unmarked</small>
            </article>)}
          </div>
        </div>
      </div>
    </section> : null}
    {submissions.length ? <section className={styles.tableWrap} aria-label="All current student marks">
      <table>
        <thead><tr><th className={styles.nameCol}>Student</th><th className={styles.instrumentCol}>Instrument</th>{ranges.map((range) => <th data-large-change={range.largeChange || undefined} data-movement-start={movementStartsHere(range) || undefined} title={rangeTitle(range)} key={range.id}>{tableRangeLabel(range)}</th>)}</tr></thead>
        <tbody>{submissions.map((submission) => <tr key={submission.id}>
          <th className={styles.nameCol} scope="row">
            {editingId === submission.id ? <form className={styles.renameForm} onSubmit={(event) => { event.preventDefault(); void changeStudent(submission, "rename"); }}>
              <label className="sr-only" htmlFor={`student-name-${submission.id}`}>Student name</label>
              <input id={`student-name-${submission.id}`} value={editingName} onChange={(event) => setEditingName(event.target.value)} minLength={2} maxLength={80} autoFocus />
              <div><button type="submit" disabled={savingId === submission.id}>Save</button><button type="button" onClick={() => setEditingId("")} disabled={savingId === submission.id}>Cancel</button></div>
            </form> : <>
              <strong>{submission.display_name}</strong>
              <span>{new Date(submission.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              <div className={styles.studentActions}>
                <button type="button" onClick={() => { setEditingId(submission.id); setEditingName(submission.display_name); }}>Rename</button>
                <button type="button" className={styles.removeButton} onClick={() => void changeStudent(submission, "remove")} disabled={savingId === submission.id}>{savingId === submission.id ? "Working…" : "Remove"}</button>
              </div>
            </>}
          </th>
          <td className={styles.instrumentCol}>{submission.instrument}</td>
          {ranges.map((range) => {
            const status = submission.marks?.[range.id] || "unmarked";
            return <td
              aria-label={LABELS[status] || "Unmarked"}
              data-status={status}
              data-large-change={range.largeChange || undefined}
              data-movement-start={movementStartsHere(range) || undefined}
              title={`${submission.display_name}: ${rangeTitle(range)}, ${LABELS[status] || "Unmarked"}`}
              key={range.id}
            />;
          })}
        </tr>)}</tbody>
      </table>
    </section> : null}
    <p className={styles.note}>This dashboard reports what students marked. It does not calculate grades or decide what the ensemble should rehearse.</p>
  </main>;
}
