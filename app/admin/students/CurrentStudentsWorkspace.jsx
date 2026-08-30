"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import {
  compareStudents,
  contactReady,
  emailValuesForStudents,
  needDescription,
} from "./current-students.logic.mjs";
import styles from "../current-students-prototype/current-students-prototype.module.css";

const ALL = "All";
const SORT_OPTIONS = [
  ["last-asc", "Last name · A–Z"],
  ["last-desc", "Last name · Z–A"],
  ["first-asc", "First name · A–Z"],
  ["first-desc", "First name · Z–A"],
  ["grade-asc", "Grade · 9–12"],
  ["grade-desc", "Grade · 12–9"],
  ["ensemble-asc", "Ensemble · A–Z"],
  ["instrument-asc", "Program instrument · A–Z"],
  ["needs-desc", "Open needs first"],
];

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function money(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}

function dateLabel(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function CurrentStudentsWorkspace({ initialStudentId = "" }) {
  return (
    <StaffGate>
      {(session, signOut) => <LiveWorkspace session={session} signOut={signOut} initialStudentId={initialStudentId} />}
    </StaffGate>
  );
}

function LiveWorkspace({ session, signOut, initialStudentId }) {
  const [view, setView] = useState("active");
  const [students, setStudents] = useState([]);
  const [counts, setCounts] = useState({ active: 0, inactive: 0 });
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loadState, setLoadState] = useState({ loading: true, error: "" });
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState(ALL);
  const [ensemble, setEnsemble] = useState(ALL);
  const [instrument, setInstrument] = useState(ALL);
  const [need, setNeed] = useState(ALL);
  const [sortBy, setSortBy] = useState("last-asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [focusedId, setFocusedId] = useState(initialStudentId);
  const [detail, setDetail] = useState(null);
  const [detailState, setDetailState] = useState({ loading: false, error: "" });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/current-students?view=${view}`, {
      headers: staffAuthHeaders(session),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Current students could not be loaded.");
        return body;
      })
      .then((body) => {
        setStudents(body.students || []);
        setCounts(body.counts || { active: 0, inactive: 0 });
        setUpdatedAt(body.updatedAt || null);
        setLoadState({ loading: false, error: "" });
        const requested = (body.students || []).find((student) => student.id === focusedId);
        const first = requested || (body.students || [])[0];
        if (first) openStudent(first.id, controller.signal);
        else { setFocusedId(""); setDetail(null); }
      })
      .catch((error) => {
        if (error.name !== "AbortError") setLoadState({ loading: false, error: error.message });
      });
    return () => controller.abort();
    // The request is intentionally keyed to the authenticated session and status view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, view]);

  function openStudent(studentId, signal) {
    setFocusedId(studentId);
    setDetailState({ loading: true, error: "" });
    fetch(`/api/admin/current-students/${encodeURIComponent(studentId)}`, {
      headers: staffAuthHeaders(session),
      signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Student details could not be loaded.");
        return body;
      })
      .then((body) => {
        setDetail(body.student || null);
        setDetailState({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetailState({ loading: false, error: error.message });
      });
  }

  const options = useMemo(() => ({
    grades: unique(students.map((student) => student.grade)),
    ensembles: unique(students.flatMap((student) => student.ensembles)),
    instruments: unique(students.map((student) => student.programInstrument)),
    needs: unique(students.flatMap((student) => student.needs)),
  }), [students]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = students.filter((student) => {
      const guardianText = student.guardians.flatMap((guardian) => [guardian.name, ...guardian.emails, ...guardian.phones]);
      const haystack = [student.displayName, student.legalName, student.schoolEmail, student.programInstrument, ...student.ensembles, ...guardianText].join(" ").toLowerCase();
      return (!term || haystack.includes(term))
        && (grade === ALL || student.grade === grade)
        && (ensemble === ALL || student.ensembles.includes(ensemble))
        && (instrument === ALL || student.programInstrument === instrument)
        && (need === ALL || student.needs.includes(need));
    });
    return [...matches].sort((a, b) => compareStudents(a, b, sortBy));
  }, [students, search, grade, ensemble, instrument, need, sortBy]);

  const followUpCount = students.filter((student) => student.needs.length).length;
  const contactGapCount = students.filter((student) => !contactReady(student)).length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id));

  function changeView(nextView) {
    setView(nextView);
    setStudents([]);
    setSelectedIds([]);
    setFocusedId("");
    setDetail(null);
    setNotice("");
    setLoadState({ loading: true, error: "" });
  }

  function clearFilters() {
    setSearch(""); setGrade(ALL); setEnsemble(ALL); setInstrument(ALL); setNeed(ALL);
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    const visibleIds = filtered.map((student) => student.id);
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  }

  async function copyEmails(axis) {
    const chosen = students.filter((student) => selectedIds.includes(student.id));
    const values = emailValuesForStudents(chosen, axis);
    if (!values.length) { setNotice("No matching emails are available in the selected rows."); return; }
    await navigator.clipboard?.writeText(values.join(", "));
    const label = axis === "student" ? "student" : axis === "guardian" ? "guardian" : "student + guardian";
    setNotice(`${values.length} ${label} emails copied.`);
  }

  async function copyStudentAndGuardians(student) {
    const values = emailValuesForStudents([student], "both");
    if (!values.length) { setNotice(`No student or guardian email is available for ${student.displayName}.`); return; }
    await navigator.clipboard?.writeText(values.join(", "));
    setNotice(`${values.length} student + guardian emails copied for ${student.displayName}.`);
  }

  function exportList() {
    const chosen = students.filter((student) => selectedIds.includes(student.id));
    if (!chosen.length) { setNotice("Select at least one student first."); return; }
    const lines = ["Student,Legal name,Grade,Ensembles,Program instrument,School email,Personal email,Student mobile,Guardians,Guardian emails,Guardian phones"];
    for (const student of chosen) lines.push([
      student.displayName, student.legalName, student.grade, student.ensembles.join(" + "), student.programInstrument,
      student.schoolEmail, student.personalEmail, student.mobile,
      student.guardians.map((guardian) => guardian.name).join(" + "),
      student.guardians.flatMap((guardian) => guardian.emails).join(" + "),
      student.guardians.flatMap((guardian) => guardian.phones).join(" + "),
    ].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${view}-students.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`${chosen.length} contact rows exported.`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav>
          <Link href="/admin">Command center</Link>
          <Link href="/admin/students/manage">Manage records</Link>
          <button type="button" onClick={signOut} className={styles.prototypeBadge}>Sign out</button>
        </nav>
      </header>

      <section className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Current operations</p>
          <h1>{view === "active" ? "Current Students" : "Inactive Students"}</h1>
          <p>{loadState.loading ? "Loading current records…" : `${students.length} ${view} students`}</p>
        </div>
        <div className={styles.viewSwitch} aria-label="Student status view">
          <button className={view === "active" ? styles.activeView : ""} onClick={() => changeView("active")}>Current <span>{counts.active}</span></button>
          <button className={view === "inactive" ? styles.activeView : ""} onClick={() => changeView("inactive")}>Inactive <span>{counts.inactive}</span></button>
        </div>
      </section>

      <section className={styles.signalBar} aria-label="Roster signals">
        <div><span>Showing</span><strong>{filtered.length}</strong></div>
        <div><span>Needs follow-up</span><strong className={followUpCount ? styles.warnText : ""}>{followUpCount}</strong></div>
        <div><span>Contact gaps</span><strong className={contactGapCount ? styles.warnText : ""}>{contactGapCount}</strong></div>
        <p>{updatedAt ? `Current record update · ${dateLabel(updatedAt)}` : "Current operational records"}</p>
      </section>

      {loadState.error ? <p className={styles.notice} role="alert">{loadState.error}</p> : null}

      <div className={`${styles.workspace} ${focusedId ? styles.withDetail : ""}`}>
        <aside className={styles.filters} aria-label="Student filters">
          <div className={styles.filterHeading}><strong>Filter</strong><button onClick={clearFilters}>Clear</button></div>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, guardian, email…" /></label>
          <FilterSelect label="Grade" value={grade} onChange={setGrade} options={options.grades} />
          <FilterSelect label="Ensemble" value={ensemble} onChange={setEnsemble} options={options.ensembles} />
          <FilterSelect label="Program instrument" value={instrument} onChange={setInstrument} options={options.instruments} />
          <FilterSelect label="Open need" value={need} onChange={setNeed} options={options.needs} />
          <div className={styles.filterNote}><strong>Filters combine.</strong><span>Every choice narrows the roster. Sort changes only the order.</span></div>
        </aside>

        <section className={styles.rosterPanel} aria-label="Student roster">
          <div className={styles.rosterToolbar}>
            <div><strong>{filtered.length} students</strong><span>{selectedIds.length ? `${selectedIds.length} selected` : "Select rows to build a list"}</span></div>
            <div className={styles.rosterTools}>
              <label className={styles.sortControl}><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{SORT_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              {selectedIds.length ? <div className={styles.listActions}>
                <button onClick={() => copyEmails("student")}>Student emails</button>
                <button onClick={() => copyEmails("guardian")}>Guardian emails</button>
                <button onClick={() => copyEmails("both")}>Student + guardian</button>
                <button onClick={exportList}>Export contacts</button>
              </div> : null}
            </div>
          </div>
          {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}
          <div className={styles.tableWrap}>
            <table>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" aria-label="Select all visible students" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
                <th>Student</th><th>Grade</th><th>Ensemble</th><th>Program instrument</th><th>Current signals</th>
              </tr></thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id} className={focusedId === student.id ? styles.focusedRow : ""}>
                    <td className={styles.checkCell}><input type="checkbox" aria-label={`Select ${student.displayName}`} checked={selectedIds.includes(student.id)} onChange={() => toggleSelected(student.id)} /></td>
                    <td><button className={styles.studentButton} onClick={() => openStudent(student.id)}><strong>{student.displayName}</strong><span>{student.status === "inactive" ? student.inactiveReason : student.schoolEmail || student.legalName}</span></button></td>
                    <td>{student.grade}</td>
                    <td><div className={styles.ensembleStack}>{student.ensembles.length ? student.ensembles.map((item) => <span key={item}>{item}</span>) : <span>Not listed</span>}</div></td>
                    <td>{student.programInstrument}</td>
                    <td><div className={styles.signalStack}>
                      <span className={contactReady(student) ? styles.goodSignal : styles.gapSignal}>{contactReady(student) ? "Contact ready" : "Contact gap"}</span>
                      {student.needs.map((item) => <span key={item} className={styles.needSignal}>{item}</span>)}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loadState.loading && !filtered.length ? <div className={styles.empty}><strong>No students match.</strong><button onClick={clearFilters}>Clear filters</button></div> : null}
          </div>
        </section>

        {focusedId ? (
          detailState.loading ? <DetailMessage message="Loading connected student record…" />
            : detailState.error ? <DetailMessage message={detailState.error} />
              : detail ? <StudentDetail student={detail} onClose={() => { setFocusedId(""); setDetail(null); }} onCopyContacts={() => copyStudentAndGuardians(detail)} /> : null
        ) : null}
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>{ALL}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function DetailMessage({ message }) {
  return <aside className={styles.detail}><section className={styles.detailSection}><p>{message}</p></section></aside>;
}

function StudentDetail({ student, onClose, onCopyContacts }) {
  const currentRequest = student.instrumentRequests[0];
  return (
    <aside className={styles.detail} aria-label={`${student.displayName} details`}>
      <header>
        <div><span>{student.status === "active" ? "Current student" : student.inactiveReason}</span><h2>{student.displayName}</h2></div>
        <button onClick={onClose} aria-label="Close student details">×</button>
      </header>

      <DetailSection title="Identity">
        <DetailLine label="Legal name" value={student.legalName} />
        <DetailLine label="Grade" value={student.grade} />
        <DetailLine label="Record status" value={student.statusValue} />
      </DetailSection>

      <DetailSection title="Current program">
        <DetailLine label="Ensembles" value={student.ensembles.join(", ") || "Not listed"} />
        <DetailLine label="Band class" value={student.bandClass || "Not listed"} />
        <DetailLine label="Program instrument" value={student.programInstrument} />
        <DetailLine label="Marching role" value={student.marchingRole || "Not marching"} />
      </DetailSection>

      <DetailSection title="Family and contact">
        <DetailLine label="School email" value={student.schoolEmail || "Missing"} />
        <DetailLine label="Personal email" value={student.personalEmail || "Not provided"} />
        <DetailLine label="Student mobile" value={student.mobile || "Not provided"} />
        {student.guardians.length ? student.guardians.map((guardian, index) => (
          <div className={styles.guardianCard} key={guardian.id}>
            <span>{index === 0 ? "Primary + emergency" : guardian.relationship}</span>
            <strong>{guardian.name}</strong>
            <p>{guardian.emails.join(", ") || "No email"} · {guardian.phones.join(", ") || "No phone"}</p>
          </div>
        )) : <div className={styles.openNeeds}>No trusted guardian is linked.</div>}
        <button className={styles.detailContactAction} onClick={onCopyContacts}>Copy student + guardian emails</button>
      </DetailSection>

      <DetailSection title="Connected work">
        <div className={styles.workGrid}>
          <WorkCard label="Attendance" value={student.attendance.total ? `${student.attendance.present} present · ${student.attendance.absent} absent` : "No observations"} href={`/attendance?student=${encodeURIComponent(student.id)}`} />
          <WorkCard label="Fees" value={money(student.finances.balanceCents) + " balance"} href={`/admin/billing?studentId=${encodeURIComponent(student.id)}`} />
          <WorkCard label="Sponsorship" value={`${money(student.finances.confirmedSponsorshipCents)} confirmed`} href={`/admin/marching-band/funding?studentId=${encodeURIComponent(student.id)}`} />
          <WorkCard label="Assets" value={`${student.instruments.length + (student.resources ? 1 : 0)} connected`} href={`/admin/instrument-inventory?studentId=${encodeURIComponent(student.id)}`} />
          <WorkCard label="Memberships" value={`${student.ensembles.length} current`} href="/admin/ensembles-memberships-prototype?view=students" />
          <WorkCard label="Forms" value="Catalog not connected" href="/admin/operations-prototype?area=forms&filter=incomplete" />
        </div>
        {student.needs.length ? <div className={styles.openNeeds}><span>Open follow-up</span><ul>{student.needs.map((item) => <li key={item}><strong>{item}</strong><small>{needDescription(item)}</small></li>)}</ul></div> : <div className={styles.clearNeeds}>No open follow-up in the connected records</div>}
      </DetailSection>

      <DetailSection title="Equipment and resources">
        <DetailLine label="Instrument request" value={currentRequest ? `${currentRequest.status} · ${currentRequest.school_year}` : "None"} />
        <DetailLine label="Assigned instruments" value={student.instruments.length ? student.instruments.map((item) => [item.instrument_type, item.brand, item.model_markings].filter(Boolean).join(" · ")).join(", ") : "None"} />
        <DetailLine label="Locker" value={student.resources?.lockerNumber || "None"} />
        <DetailLine label="Tuner" value={student.resources?.tunerNumber || "None"} />
      </DetailSection>

      <DetailSection title="Money is kept in two records">
        <DetailLine label="Fees charged" value={money(student.finances.chargedCents)} />
        <DetailLine label="Fee payments" value={money(student.finances.paidCents)} />
        <DetailLine label="Fee balance" value={money(student.finances.balanceCents)} />
        <DetailLine label="Confirmed gifts" value={money(student.finances.confirmedSponsorshipCents)} />
        <DetailLine label="Gift credits" value={money(student.finances.creditedSponsorshipCents)} />
      </DetailSection>
    </aside>
  );
}

function DetailSection({ title, children }) {
  return <section className={styles.detailSection}><h3>{title}</h3>{children}</section>;
}

function DetailLine({ label, value }) {
  return <div className={styles.detailLine}><span>{label}</span><strong>{value}</strong></div>;
}

function WorkCard({ label, value, href }) {
  return <Link href={href}><span>{label}</span><strong>{value}</strong><small>Open →</small></Link>;
}
