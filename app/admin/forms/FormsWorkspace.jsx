"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "./forms.module.css";

const COMPLETE = new Set(["complete", "waived", "not_required"]);
const REVIEW = new Set(["submitted", "needs_review"]);

function studentName(row) {
  return [row.student.legalLast, row.student.preferredFirst || row.student.legalFirst]
    .filter(Boolean).join(", ") || row.student.displayName;
}

export default function FormsWorkspace(props) {
  return <StaffGate>{(session, signOut) => <LiveForms {...props} session={session} signOut={signOut} />}</StaffGate>;
}

function LiveForms({ session, signOut, initialStudentId, initialView }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState(initialStudentId);
  const [view, setView] = useState(["needs", "requirement", "student", "complete"].includes(initialView) ? initialView : "needs");
  const [search, setSearch] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [status, setStatus] = useState("");
  const [delivery, setDelivery] = useState("");
  const [sort, setSort] = useState("student");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch(`/api/admin/forms${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`, { headers: staffAuthHeaders(session) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not load form requirements.");
    setData(body);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/forms${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`, { headers: staffAuthHeaders(session) })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Could not load form requirements.");
        if (!cancelled) setData(body);
      }).catch((loadError) => { if (!cancelled) setError(loadError.message); });
    return () => { cancelled = true; };
  }, [session, studentId]);

  const selectedStudent = data?.students.find((student) => student.id === studentId) || null;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = (data?.rows || []).filter((row) => {
      if (studentId && row.student.id !== studentId) return false;
      if (view === "needs" && COMPLETE.has(row.state)) return false;
      if (view === "complete" && !COMPLETE.has(row.state)) return false;
      if (requirementId && row.requirementId !== requirementId) return false;
      if (status && row.state !== status) return false;
      if (delivery && row.deliveryType !== delivery) return false;
      if (term && ![studentName(row), row.student.displayName, row.definition.title, row.stateLabel, row.source].join(" ").toLowerCase().includes(term)) return false;
      return true;
    });
    return [...visible].sort((left, right) => {
      if (sort === "requirement") return left.definition.title.localeCompare(right.definition.title) || studentName(left).localeCompare(studentName(right));
      if (sort === "due") return String(left.dueOn || "9999").localeCompare(String(right.dueOn || "9999")) || studentName(left).localeCompare(studentName(right));
      if (sort === "updated") return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
      return studentName(left).localeCompare(studentName(right)) || left.definition.title.localeCompare(right.definition.title);
    });
  }, [data, delivery, requirementId, search, sort, status, studentId, view]);

  function location(next = {}) {
    const values = { view, student: studentId, ...next };
    const params = new URLSearchParams();
    if (values.view !== "needs") params.set("view", values.view);
    if (values.student) params.set("student", values.student);
    window.history.replaceState(null, "", `/admin/forms${params.size ? `?${params}` : ""}`);
  }

  function chooseStudent(next) { setStudentId(next); location({ student: next }); }
  function chooseView(next) { setView(next); location({ view: next }); }

  async function updateStatus(row, nextState) {
    let note = "";
    if (["waived", "not_required", "needs_correction", "reopened"].includes(nextState)) {
      note = window.prompt("Add the reason for this status change:", "")?.trim() || "";
      if (!note) { setNotice("A reason is required for that status change."); return; }
    }
    setSaving(row.id); setNotice("");
    const response = await fetch("/api/admin/forms", {
      method: "PATCH", headers: staffAuthHeaders(session),
      body: JSON.stringify({ requirementId: row.requirementId, studentId: row.student.id, state: nextState, completionMode: row.deliveryType, note }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving("");
    if (!response.ok) { setNotice(body.error || "Could not update the status."); return; }
    setNotice(`${row.student.displayName} · ${row.definition.title} updated.`);
    await load();
  }

  const metricRows = (data?.rows || []).filter((row) => {
    if (studentId && row.student.id !== studentId) return false;
    if (requirementId && row.requirementId !== requirementId) return false;
    if (status && row.state !== status) return false;
    if (delivery && row.deliveryType !== delivery) return false;
    if (search.trim() && ![studentName(row), row.student.displayName, row.definition.title, row.stateLabel, row.source].join(" ").toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });
  const summary = metricRows.reduce((result, row) => {
    if (COMPLETE.has(row.state)) result.complete += 1;
    else if (REVIEW.has(row.state)) result.review += 1;
    else result.action += 1;
    return result;
  }, { action: 0, review: 0, complete: 0 });
  return <main className={styles.page}>
    <header className={styles.appBar}><div><strong>Ashley Bands</strong><span>Staff workspace</span></div><nav><Link href="/admin">Command center</Link><Link href="/admin/students">Current students</Link><button onClick={signOut}>Sign out</button></nav></header>
    <section className={styles.heading}><div><p>Current operations</p><h1>Forms</h1><span>What is required, where it lives, and what happens next.</span></div><div className={styles.tabs}><button className={view === "needs" ? styles.active : ""} onClick={() => chooseView("needs")}>Needs action</button><button className={view === "requirement" ? styles.active : ""} onClick={() => { chooseView("requirement"); setSort("requirement"); }}>All by requirement</button><button className={view === "student" ? styles.active : ""} onClick={() => { chooseView("student"); setSort("student"); }}>All by student</button><button className={view === "complete" ? styles.active : ""} onClick={() => chooseView("complete")}>Complete</button></div></section>
    <section className={styles.metrics}><Metric label="Needs action" value={data && !error ? summary.action : "—"} tone={data && summary.action ? "warn" : ""} /><Metric label="Submitted / review" value={data && !error ? summary.review : "—"} /><Metric label="Complete / waived" value={data && !error ? summary.complete : "—"} /></section>
    {selectedStudent ? <section className={styles.scopeBar}><div><span>Student context</span><strong>{selectedStudent.displayName}</strong><p>{selectedStudent.grade || "Grade not listed"}</p></div><div><Link href={`/admin/students?student=${encodeURIComponent(selectedStudent.id)}`}>Open full student</Link><button onClick={() => chooseStudent("")}>Show full program</button></div></section> : null}
    {error ? <p className={styles.error}>{error}</p> : null}{notice ? <p className={styles.notice}>{notice}</p> : null}
    <div className={styles.workspace}><aside className={styles.filters}><strong>Find requirements</strong><label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student or form" /></label><label><span>Requirement</span><select value={requirementId} onChange={(event) => setRequirementId(event.target.value)}><option value="">All requirements</option>{(data?.definitions || []).map((item) => <option key={item.requirementId} value={item.requirementId}>{item.title}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="not_started">Not started</option><option value="submitted">Submitted</option><option value="needs_review">Needs review</option><option value="needs_correction">Needs correction</option><option value="complete">Complete</option><option value="waived">Waived</option></select></label><label><span>Completion</span><select value={delivery} onChange={(event) => setDelivery(event.target.value)}><option value="">All modes</option><option value="portal">AshleyBands</option><option value="external">External</option><option value="paper">Paper</option><option value="staff_record">Staff record</option></select></label><button className={styles.clear} onClick={() => { setSearch(""); setRequirementId(""); setStatus(""); setDelivery(""); }}>Clear filters</button></aside>
      <section className={styles.results}><header><div><strong>{selectedStudent ? `${selectedStudent.displayName} · forms` : "Current form requirements"}</strong><span>{error ? "Unavailable" : data ? `${rows.length} records` : "Loading…"}</span></div><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="student">Student</option><option value="requirement">Requirement</option><option value="due">Due date</option><option value="updated">Recently updated</option></select></label></header>{error ? <p className={styles.empty}>Form records are unavailable right now.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Student</th><th>Requirement</th><th>Status</th><th>Completion</th><th>Next action</th></tr></thead><tbody>{rows.map((row) => <FormRow key={`${row.requirementId}:${row.student.id}`} row={row} onOpenStudent={() => chooseStudent(row.student.id)} onUpdate={updateStatus} saving={saving === row.id} />)}</tbody></table></div>}{data && !rows.length && !error ? <p className={styles.empty}>No current requirements match.</p> : null}</section></div>
    <p className={styles.source}>Sources: connected onboarding, instrument responsibility agreements, and staff-tracked requirement records. No medical or legal document is stored here by default. Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "when source records change"}.</p>
  </main>;
}

function Metric({ label, value, tone = "" }) { return <div className={tone ? styles[tone] : ""}><span>{label}</span><strong>{value}</strong></div>; }

function FormRow({ row, onOpenStudent, onUpdate, saving }) {
  const tone = COMPLETE.has(row.state) ? "good" : REVIEW.has(row.state) ? "review" : "warnStatus";
  return <tr><td data-label="Student"><button className={styles.student} onClick={onOpenStudent}><strong>{studentName(row)}</strong><span>{row.student.grade}</span></button></td><td data-label="Requirement"><strong>{row.definition.title}</strong><small>{row.source} · {row.schoolYear}</small></td><td data-label="Status"><span className={`${styles.status} ${styles[tone]}`}>{row.stateLabel}</span></td><td data-label="Completion">{row.deliveryType.replace("staff_record", "staff record")}</td><td data-label="Next action"><div className={styles.actions}>{row.actionHref ? <Link href={row.actionHref}>{row.nextAction || "Open form"}</Link> : null}{row.fulfillmentLabel ? <span>{row.fulfillmentLabel}</span> : row.systemOwned && !row.actionHref ? <span>{row.nextAction || (COMPLETE.has(row.state) ? "Recorded by connected workflow" : "Waiting on family workflow")}</span> : !row.systemOwned ? <select aria-label={`Update ${row.definition.title} for ${row.student.displayName}`} disabled={saving} value={row.state} onChange={(event) => onUpdate(row, event.target.value)}><option value="not_started">Not started</option><option value="submitted">Submitted</option><option value="needs_review">Needs review</option><option value="needs_correction">Needs correction</option><option value="complete">Complete</option><option value="waived">Waived</option><option value="not_required">Not required</option></select> : null}</div></td></tr>;
}
