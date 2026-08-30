"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "../attendance-workspace-prototype/attendance-workspace-prototype.module.css";

const PROGRAM_VIEWS = [["events", "Events"], ["ready", "Needs attendance"], ["concerns", "Student concerns"]];
const SCHOOL_VIEWS = [["registers", "Registers"], ["classes", "Classes"], ["absent", "Absences"], ["tardy", "Tardies"]];
const ABSENCE_CODES = new Set(["A", "U", "?"]);

function dateLabel(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`));
}

function eventDate(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York"
  }).format(new Date(value));
}

function lifecycleLabel(event) {
  if (event.lifecycleState === "completed") return "Complete";
  if (event.rosterCompleteness === "reconstructing") return "Building roster";
  if (event.rosterCompleteness === "observed_only") return "Saved records only";
  if (event.rosterCompleteness === "missing" && eventIsPast(event)) return "Needs roster";
  if (event.lifecycleState === "open") return event.unmarkedCount ? "In progress" : "Ready to complete";
  return "Upcoming";
}

function toneForEvent(event) {
  return event.lifecycleState === "completed" ? "good"
    : !eventIsPast(event) && event.lifecycleState !== "open" ? "plain"
    : event.rosterCompleteness === "observed_only" || event.unmarkedCount ? "warn"
      : "plain";
}

function attendanceLabel(status) {
  return status ? status.replace("_", " ") : "Unmarked";
}

function eventTime(event) {
  const value = event.startsAt;
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventIsPast(event) {
  if (typeof event.isHistorical === "boolean") return event.isHistorical;
  if (typeof event.isPast === "boolean") return event.isPast;
  const value = event.endsAt ? new Date(event.endsAt).getTime() : eventTime(event);
  return Boolean(value && value < Date.now());
}

function eventNeedsAction(event) {
  if (typeof event.needsAction === "boolean") return event.needsAction;
  if (event.lifecycleState === "completed") return false;
  if (event.lifecycleState === "open") return event.unmarkedCount > 0 || event.rosterCompleteness === "missing";
  return eventIsPast(event) && (event.rosterCompleteness === "missing" || event.unmarkedCount > 0);
}

function sortNearestFirst(left, right) {
  return Math.abs(eventTime(left) - Date.now()) - Math.abs(eventTime(right) - Date.now());
}

export default function AttendanceWorkspace(props) {
  return <StaffGate>{(session, signOut) => <AuthenticatedWorkspace {...props} session={session} signOut={signOut} />}</StaffGate>;
}

function AuthenticatedWorkspace({
  initialSource = "program",
  initialView = "",
  initialStudentId = "",
  initialOccurrenceKey = "",
  session,
  signOut
}) {
  const [source, setSource] = useState(initialSource);
  const [view, setView] = useState(initialView || (initialSource === "school" ? "registers" : "events"));
  const [studentId, setStudentId] = useState(initialStudentId);
  const [occurrenceKey, setOccurrenceKey] = useState(initialOccurrenceKey);
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const detailRef = useRef(null);

  const writeLocation = useCallback((next = {}) => {
    const values = { source, view, student: studentId, occurrence: occurrenceKey, ...next };
    const params = new URLSearchParams();
    if (values.source === "school") params.set("source", "school");
    const defaultView = values.source === "school" ? "registers" : "events";
    if (values.view && values.view !== defaultView) params.set("view", values.view);
    if (values.student) params.set("student", values.student);
    if (values.occurrence) params.set("occurrence", values.occurrence);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }, [occurrenceKey, source, studentId, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ source });
      if (studentId) params.set("student", studentId);
      if (source === "program" && occurrenceKey) params.set("occurrence", occurrenceKey);
      const response = await fetch(`/api/admin/attendance?${params.toString()}`, {
        headers: staffAuthHeaders(session),
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Attendance records could not be loaded.");
      setData(result);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [occurrenceKey, session, source, studentId]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function chooseSource(nextSource) {
    const nextView = nextSource === "school" ? "registers" : "events";
    setSource(nextSource);
    setView(nextView);
    setOccurrenceKey("");
    setImportOpen(false);
    setSearch("");
    writeLocation({ source: nextSource, view: nextView, occurrence: "" });
  }

  function chooseView(nextView) {
    setView(nextView);
    setOccurrenceKey("");
    setImportOpen(false);
    writeLocation({ view: nextView, occurrence: "" });
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId);
    setOccurrenceKey("");
    setImportOpen(false);
    writeLocation({ student: nextStudentId, occurrence: "" });
  }

  function openEvent(nextOccurrenceKey) {
    setOccurrenceKey(nextOccurrenceKey);
    setImportOpen(false);
    writeLocation({ occurrence: nextOccurrenceKey });
  }

  const views = source === "school" ? SCHOOL_VIEWS : PROGRAM_VIEWS;
  const student = data?.student || null;
  const hasDetail = Boolean(importOpen || data?.selected);
  const liveParams = new URLSearchParams();
  if (occurrenceKey) liveParams.set("occurrence", occurrenceKey);
  if (studentId) liveParams.set("student", studentId);
  const liveHref = liveParams.size ? `/attendance?${liveParams.toString()}` : "/attendance";

  useEffect(() => {
    if (!hasDetail || !detailRef.current || typeof window.matchMedia !== "function"
      || !window.matchMedia("(max-width: 780px)").matches) return;
    const timer = window.requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(timer);
  }, [hasDetail, importOpen, occurrenceKey]);

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav>
          <Link href="/admin">Command center</Link>
          <Link href="/admin/students">Current students</Link>
          <Link href={liveHref}>Live attendance</Link>
          <button className={styles.rowAction} type="button" onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <section className={styles.heading}>
        <div><p className={styles.eyebrow}>Current operations</p><h1>Attendance</h1><p>Two sources. One connected student record.</p></div>
        <div className={styles.sourceSwitch} aria-label="Attendance source">
          <button className={source === "program" ? styles.activeSource : ""} onClick={() => chooseSource("program")}><strong>Program Events</strong><span>AshleyBands record</span></button>
          <button className={source === "school" ? styles.activeSource : ""} onClick={() => chooseSource("school")}><strong>School Day</strong><span>Infinite Campus official</span></button>
        </div>
      </section>

      <section className={styles.sourceRule} data-source={source}>
        <div><strong>{source === "program" ? "Taken in AshleyBands" : "Imported from Infinite Campus"}</strong><span>{source === "program" ? "Concerts, rehearsals, games, trips, and other events." : "The PDF is a private tracking copy. Infinite Campus remains official."}</span></div>
        {source === "school" ? <button className={styles.importAction} onClick={() => { setImportOpen(true); setOccurrenceKey(""); writeLocation({ occurrence: "" }); }}>Import register</button> : null}
      </section>

      {student ? <section className={styles.scopeBar}>
        <div><span>Student context</span><strong>{student.displayName}</strong><p>Program and school-day records remain separate.</p></div>
        <div><Link href={`/admin/students?student=${encodeURIComponent(student.id)}`}>Open full student</Link><button onClick={() => scopeStudent("")}>Show full program</button></div>
      </section> : null}

      <SignalBar source={source} data={data} />
      {(error || notice) && <section className={styles.sourceRule} data-source={error ? "school" : source}><div><strong>{error ? "Could not load" : "Saved"}</strong><span>{error || notice}</span></div></section>}

      <div className={[styles.workspace, hasDetail ? styles.withDetail : ""].filter(Boolean).join(" ")}>
        <aside className={styles.filters}>
          <div className={styles.filterHeading}><strong>{student ? "This student" : "Questions"}</strong></div>
          <div className={styles.viewButtons}>{views.map(([value, label]) => <button key={value} className={view === value ? styles.activeView : ""} onClick={() => chooseView(value)}>{label}</button>)}</div>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={source === "program" ? "Event or group..." : "Class, student, or code..."} /></label>
          <p className={styles.filterNote}>{source === "program" ? "Program-event totals stay separate from the school day." : "Blank and future cells are never counted as present."}</p>
        </aside>

        <section className={styles.resultsPanel}>
          {loading ? <EmptyState>Loading current attendance…</EmptyState>
            : student ? <StudentResults source={source} student={student} data={data} onEvent={openEvent} />
              : source === "program"
                ? <ProgramResults data={data} view={view} search={search} onEvent={openEvent} onStudent={scopeStudent} />
                : <SchoolResults data={data} view={view} search={search} onStudent={scopeStudent} />}
        </section>

        {data?.selected ? <ProgramEventDetail
          event={data.selected}
          studentId={studentId}
          session={session}
          detailRef={detailRef}
          onClose={() => { setOccurrenceKey(""); writeLocation({ occurrence: "" }); }}
          onStudent={scopeStudent}
          onChanged={async (message) => { setNotice(message); await load(); }}
          onError={setError}
        /> : null}
        {importOpen ? <SchoolImport
          session={session}
          detailRef={detailRef}
          onClose={() => setImportOpen(false)}
          onAccepted={async () => { setImportOpen(false); setNotice("Infinite Campus register accepted."); await load(); }}
          onError={setError}
        /> : null}
      </div>
    </main>
  );
}

function SignalBar({ source, data }) {
  if (source === "program") {
    const events = data?.events || [];
    const needsAction = events.filter(eventNeedsAction).length;
    return <section className={styles.signalBar}><div><span>Sessions</span><strong>{events.length}</strong></div><div><span>Need action</span><strong className={styles.warnText}>{needsAction}</strong></div><div><span>Concerns</span><strong>{data?.concerns?.length || 0}</strong></div><p>Outside the normal school day</p></section>;
  }
  const coverage = data?.coverage;
  const coverageLabel = coverage
    ? coverage.from === coverage.through
      ? `Current sections through ${dateLabel(coverage.through)}`
      : `Section coverage ${dateLabel(coverage.from)}–${dateLabel(coverage.through)}`
    : "No register imported yet";
  return <section className={styles.signalBar}><div><span>Registers</span><strong>{data?.imports?.length || 0}</strong></div><div><span>Current sections</span><strong>{data?.sections?.length || 0}</strong></div><div><span>Explicit marks</span><strong className={styles.warnText}>{data?.marks?.length || 0}</strong></div><p>{coverageLabel}</p></section>;
}

function ProgramResults({ data, view, search, onEvent, onStudent }) {
  const term = search.trim().toLowerCase();
  if (view === "concerns") {
    const rows = (data?.concerns || []).filter((row) => !term || row.student.displayName.toLowerCase().includes(term));
    return <ResultTable title="Completed-event concerns" count={rows.length} badge="Completed events"><table><thead><tr><th>Student</th><th>Absences</th><th>Tardies</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.student.id}><td data-label="Student"><strong>{row.student.displayName}</strong><small>Grade {row.student.grade} · {row.student.instrument}</small></td><td data-label="Absences">{row.absentCount}</td><td data-label="Tardies">{row.tardyCount}</td><td data-label="Action"><button className={styles.rowAction} onClick={() => onStudent(row.student.id)}>Open attendance</button></td></tr>)}</tbody></table></ResultTable>;
  }
  const matches = (data?.events || []).filter((event) => !term
    || [event.title, ...(event.groups || [])].join(" ").toLowerCase().includes(term));
  const action = matches.filter(eventNeedsAction).sort(sortNearestFirst);
  if (view === "ready") {
    return <ProgramEventTable title="Needs attendance action" badge="Current action" rows={action} onEvent={onEvent} />;
  }
  const upcoming = matches.filter((event) => !eventNeedsAction(event) && !eventIsPast(event))
    .sort((left, right) => eventTime(left) - eventTime(right));
  const history = matches.filter((event) => !eventNeedsAction(event) && eventIsPast(event))
    .sort((left, right) => eventTime(right) - eventTime(left));
  if (!action.length && !upcoming.length && !history.length) return <EmptyState>No program events match this view.</EmptyState>;
  return <div className={styles.resultGroups}>
    {action.length ? <ProgramEventTable title="Needs attention" badge="Current action" rows={action} onEvent={onEvent} /> : null}
    {upcoming.length ? <ProgramEventTable title="Upcoming" badge="Upcoming events" rows={upcoming} onEvent={onEvent} /> : null}
    {history.length ? <ProgramEventTable title="History" badge="Past events" rows={history} onEvent={onEvent} /> : null}
  </div>;
}

function ProgramEventTable({ title, badge, rows, onEvent }) {
  return <ResultTable title={title} count={rows.length} badge={badge}><table><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Status</th><th>Results</th><th></th></tr></thead><tbody>{rows.map((event) => <tr key={event.id}><td data-label="Date"><strong>{eventDate(event.startsAt)}</strong></td><td data-label="Event">{event.title}</td><td data-label="Group">{event.groups.join(" + ") || "Not mapped"}</td><td data-label="Status"><Status tone={toneForEvent(event)}>{lifecycleLabel(event)}</Status></td><td data-label="Results">{event.expectedCount === null ? `${event.savedRecordCount} saved records` : `${event.presentCount} P · ${event.tardyCount} T · ${event.absentCount} A · ${event.unmarkedCount} open`}</td><td data-label="Action"><button className={styles.rowAction} onClick={() => onEvent(event.occurrenceKey)}>Open session</button></td></tr>)}</tbody></table></ResultTable>;
}

function SchoolResults({ data, view, search, onStudent }) {
  const term = search.trim().toLowerCase();
  if (view === "registers") {
    const rows = (data?.imports || []).filter((item) => !term || [item.term, item.school_year, item.generated_local].join(" ").toLowerCase().includes(term));
    return <ResultTable title="Imported Infinite Campus registers" count={rows.length} badge="Import history">{rows.length ? <table><thead><tr><th>Generated</th><th>Term</th><th>Through</th><th>Sections</th><th>Roster</th><th>Marks</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td data-label="Generated"><strong>{item.generated_local}</strong><small>Accepted {eventDate(item.accepted_at)}</small></td><td data-label="Term">{item.term || "Not listed"}</td><td data-label="Through">{dateLabel(item.through_date)}</td><td data-label="Sections">{item.section_count}</td><td data-label="Roster">{item.roster_row_count}</td><td data-label="Marks">{item.mark_count}</td></tr>)}</tbody></table> : <EmptyState>No attendance register has been imported.</EmptyState>}</ResultTable>;
  }
  if (view === "classes") {
    const rows = (data?.sections || []).filter((section) => !term || [section.name, section.code].join(" ").toLowerCase().includes(term));
    return <ResultTable title="Current class-section copies" count={rows.length} badge="Section-current IC copies"><table><thead><tr><th>Class</th><th>Section</th><th>Roster</th><th>Through</th><th>Source</th></tr></thead><tbody>{rows.map((section) => <tr key={section.code}><td data-label="Class"><strong>{section.name}</strong></td><td data-label="Section">{section.code}</td><td data-label="Roster">{section.rosterCount}</td><td data-label="Through">{dateLabel(section.throughDate)}</td><td data-label="Source"><Status tone="source">Infinite Campus</Status></td></tr>)}</tbody></table></ResultTable>;
  }
  const rows = (data?.marks || []).filter((mark) => view === "tardy" ? mark.code === "T" : ABSENCE_CODES.has(mark.code)).filter((mark) => !term || [mark.studentName, mark.sectionCode, mark.code, mark.meaning].join(" ").toLowerCase().includes(term));
  return <ResultTable title={view === "tardy" ? "School-day tardies" : "School-day absences"} count={rows.length} badge="Current IC section copies"><table><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Code</th><th>Official meaning</th><th></th></tr></thead><tbody>{rows.map((mark) => <tr key={mark.id}><td data-label="Date"><strong>{dateLabel(mark.attendanceDate)}</strong></td><td data-label="Student">{mark.studentName}<small>Grade {mark.grade}</small></td><td data-label="Class">{mark.sectionCode}</td><td data-label="Code"><Status tone="warn">{mark.code}</Status></td><td data-label="Official meaning">{mark.meaning}</td><td data-label="Action"><button className={styles.rowAction} onClick={() => onStudent(mark.studentId)}>Open student</button></td></tr>)}</tbody></table></ResultTable>;
}

function StudentResults({ source, student, data, onEvent }) {
  if (source === "program") {
    const events = student.events || [];
    return <><section className={styles.studentSummary}><div><span>Student</span><strong>{student.displayName}</strong></div><div><span>Program events</span><strong>{events.length}</strong></div><div><span>Source</span><strong>AshleyBands</strong></div></section><ResultTable title="Program-event records" count={events.length} badge="Student history"><table><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Status</th><th></th></tr></thead><tbody>{events.map((event) => <tr key={event.occurrenceKey}><td data-label="Date">{dateLabel(event.localDate)}</td><td data-label="Event"><strong>{event.title}</strong><small>{event.rosterCompleteness === "observed_only" ? "Saved records only" : event.lifecycleState}</small></td><td data-label="Group">{event.groups.join(" + ")}</td><td data-label="Status">{attendanceLabel(event.status)}</td><td data-label="Action"><button className={styles.rowAction} onClick={() => onEvent(event.occurrenceKey)}>Open event</button></td></tr>)}</tbody></table></ResultTable></>;
  }
  const marks = data?.marks || [];
  return <><section className={styles.studentSummary}><div><span>Student</span><strong>{student.displayName}</strong></div><div><span>Current section marks</span><strong>{marks.length}</strong></div><div><span>Source</span><strong>Infinite Campus</strong></div></section><ResultTable title="Official marks in current section copies" count={marks.length} badge="Current IC section copies">{marks.length ? <table><thead><tr><th>Date</th><th>Class</th><th>Code</th><th>Meaning</th></tr></thead><tbody>{marks.map((mark) => <tr key={mark.id}><td data-label="Date">{dateLabel(mark.attendanceDate)}</td><td data-label="Class">{mark.sectionCode}</td><td data-label="Code"><Status tone="warn">{mark.code}</Status></td><td data-label="Meaning">{mark.meaning}</td></tr>)}</tbody></table> : <EmptyState>No explicit school-day marks in the current section copies.</EmptyState>}</ResultTable></>;
}

function ProgramEventDetail({ event, studentId, session, detailRef, onClose, onStudent, onChanged, onError }) {
  const [candidateId, setCandidateId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function adjust(studentId, include) {
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: staffAuthHeaders(session),
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey, studentId, include, reason })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The event roster could not be adjusted.");
      setCandidateId("");
      setReason("");
      await onChanged(include ? "Student added to this event roster." : "Student removed from this event roster.");
    } catch (adjustError) {
      onError(adjustError.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeStudent(student) {
    const hasSavedRecords = Boolean(student.hasSavedRecords);
    if (hasSavedRecords && !window.confirm(`Remove ${student.displayName} and archive the saved attendance record for correction?`)) return;
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: staffAuthHeaders(session),
        body: JSON.stringify({
          occurrenceKey: event.occurrenceKey,
          studentId: student.id,
          include: false,
          removeWithRecords: hasSavedRecords,
          reason
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The student could not be removed from this event.");
      setReason("");
      await onChanged(hasSavedRecords
        ? "Student removed; the prior attendance record was preserved in correction history."
        : "Student removed from this event roster.");
    } catch (removeError) {
      onError(removeError.message);
    } finally {
      setBusy(false);
    }
  }
  async function eventAction(action, successMessage) {
    if (!reason.trim()) {
      onError("Enter a reason first.");
      return;
    }
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: staffAuthHeaders(session),
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey, [action]: true, reason })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The attendance event could not be updated.");
      setReason("");
      await onChanged(successMessage);
    } catch (actionError) {
      onError(actionError.message);
    } finally {
      setBusy(false);
    }
  }
  async function startReconstruction() {
    if (!window.confirm("Start a manual expected-roster reconstruction for this past event? No current roster will be copied automatically.")) return;
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: staffAuthHeaders(session),
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey, startReconstruction: true })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Historical reconstruction could not be started.");
      await onChanged("Historical roster reconstruction started. Add only students known to have been expected for this date.");
    } catch (reconstructionError) {
      onError(reconstructionError.message);
    } finally {
      setBusy(false);
    }
  }
  const liveParams = new URLSearchParams({ occurrence: event.occurrenceKey });
  if (studentId) liveParams.set("student", studentId);
  return <aside ref={detailRef} tabIndex={-1} className={styles.detail} aria-label={`${event.title} attendance details`}>
    <DetailHeader eyebrow="AshleyBands record" title={event.title} subtitle={eventDate(event.startsAt)} onClose={onClose} />
    <section className={styles.detailSection}><h3>Summary</h3><div className={styles.detailCounts}><div><strong>{event.presentCount}</strong><span>Present</span></div><div><strong>{event.tardyCount}</strong><span>Tardy</span></div><div><strong>{event.absentCount}</strong><span>Absent</span></div><div><strong>{event.unmarkedCount ?? "—"}</strong><span>Unmarked</span></div></div><Link className={styles.liveLink} href={`/attendance?${liveParams.toString()}`}>Open live attendance tool →</Link>{event.rosterCompleteness === "observed_only" ? <p className={styles.officialNote}>Saved records only. Review the expected students before certifying this history.</p> : null}{event.rosterCompleteness === "reconstructing" ? <p className={styles.officialNote}>Roster reconstruction is in progress. Attendance stays read-only until you finish the expected roster.</p> : null}{event.rosterCompleteness === "missing" && !event.rosterLocked && new Date(event.startsAt) < new Date() ? <button className={styles.previewButton} type="button" disabled={busy} onClick={startReconstruction}>Start manual historical roster</button> : null}</section>
    <section className={styles.detailSection}><h3>Students</h3><div className={styles.studentRows}>{event.students.map((student) => <div key={student.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".6rem", borderBottom: "1px solid #ece5db", padding: ".5rem 0" }}><button type="button" className={styles.rowAction} onClick={() => onStudent(student.id)} style={{ textAlign: "left" }}><strong style={{ display: "block" }}>{student.displayName}</strong><small style={{ color: "#647067" }}>{student.role}</small></button><span style={{ display: "flex", alignItems: "center", gap: ".4rem" }}><Status tone={student.status === "absent" ? "warn" : student.status ? "good" : "plain"}>{attendanceLabel(student.status)}</Status>{event.rosterLocked && event.lifecycleState === "open" ? <button type="button" disabled={busy || !reason.trim()} className={styles.rowAction} onClick={() => removeStudent(student)}>Remove</button> : null}</span></div>)}</div></section>
    {event.rosterLocked && event.lifecycleState === "open" ? <section className={styles.detailSection}><h3>{["observed_only", "reconstructing"].includes(event.rosterCompleteness) ? "Build expected roster" : "Correct expected roster"}</h3><p className={styles.detailCopy}>{["observed_only", "reconstructing"].includes(event.rosterCompleteness) ? "Add or remove students until this is the exact expected roster for that date." : "Use this only when the expected students for this date were wrong."}</p><input className={styles.previewButton} value={reason} onChange={(change) => setReason(change.target.value)} placeholder="Reason or verification note" />{event.candidates.length ? <><select className={styles.previewButton} value={candidateId} onChange={(change) => setCandidateId(change.target.value)}><option value="">Choose a student</option>{event.candidates.map((student) => <option key={student.id} value={student.id}>{student.displayName}{student.status === "active" ? "" : " · Inactive"}</option>)}</select><button className={styles.previewButton} type="button" disabled={!candidateId || !reason.trim() || busy} onClick={() => adjust(candidateId, true)}>{busy ? "Saving…" : "Add to this event only"}</button></> : null}{["observed_only", "reconstructing"].includes(event.rosterCompleteness) ? <button className={styles.previewButton} type="button" disabled={!event.students.length || !reason.trim() || busy} onClick={() => eventAction("certifyRoster", "Historical expected roster certified. Attendance is now ready for review and completion.")}>{busy ? "Saving…" : "Finish expected roster"}</button> : null}</section> : null}
    {event.lifecycleState === "completed" ? <section className={styles.detailSection}><h3>Correction</h3><p className={styles.detailCopy}>Reopen the completed session before changing a mark or expected student.</p><input className={styles.previewButton} value={reason} onChange={(change) => setReason(change.target.value)} placeholder="Reason for reopening" /><button className={styles.previewButton} type="button" disabled={!reason.trim() || busy} onClick={() => eventAction("reopen", "Attendance reopened for correction.")}>{busy ? "Saving…" : "Reopen for correction"}</button></section> : null}
  </aside>;
}

function SchoolImport({ session, detailRef, onClose, onAccepted, onError }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mappings, setMappings] = useState({});
  const [acceptSuggestions, setAcceptSuggestions] = useState(false);
  const [completeSections, setCompleteSections] = useState(false);
  const [busy, setBusy] = useState(false);
  const unresolvedReady = useMemo(() => (preview?.rows || [])
    .filter((row) => row.matchStatus === "unresolved")
    .every((row) => Boolean(mappings[row.rowKey])), [mappings, preview]);

  function authHeaders() {
    const headers = staffAuthHeaders(session);
    delete headers["Content-Type"];
    return headers;
  }

  async function submit(mode) {
    if (!file) return;
    setBusy(true);
    onError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      if (mode === "commit") {
        form.set("manualMappings", JSON.stringify(mappings));
        form.set("acceptSuggestions", String(acceptSuggestions));
        form.set("completeSections", String(completeSections));
      }
      const response = await fetch("/api/admin/attendance/school-import", { method: "POST", headers: authHeaders(), body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(result.details)
          ? result.details.map((issue) => [issue.page ? `Page ${issue.page}:` : "", issue.message || issue.error || issue].filter(Boolean).join(" ")).join(" ")
          : "";
        throw new Error([result.error || "The register could not be processed.", details].filter(Boolean).join(" "));
      }
      if (mode === "preview") setPreview(result);
      else await onAccepted();
    } catch (importError) {
      onError(importError.message);
    } finally {
      setBusy(false);
    }
  }

  const automaticRows = (preview?.rows || []).filter((row) => row.matchStatus === "automatic");
  const reviewRows = (preview?.rows || []).filter((row) => row.matchStatus !== "automatic");
  const matchRow = (row) => <div key={row.rowKey} className={styles.matchRow}><strong>{row.sourceName}</strong><small>{row.sectionName} · ID ending {row.sourceStudentLast4}</small>{row.matchStatus === "automatic" ? <p className={styles.officialNote}>Matched: {row.proposedStudent.displayName}</p> : <select className={styles.previewButton} value={mappings[row.rowKey] || ""} onChange={(event) => setMappings((current) => ({ ...current, [row.rowKey]: event.target.value }))}><option value="">{row.proposedStudent ? `Use suggestion: ${row.proposedStudent.displayName}` : "Choose a student"}</option>{preview.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.legalName} · Grade {candidate.grade}</option>)}</select>}</div>;
  return <aside ref={detailRef} tabIndex={-1} className={styles.detail} aria-label="Import Infinite Campus register">
    <DetailHeader eyebrow="Private tracking copy" title="Import register" subtitle="Infinite Campus PDF" onClose={onClose} />
    <section className={styles.detailSection}><h3>Choose report</h3><p className={styles.detailCopy}>Use the Attendance Register PDF. The original file and raw district numbers are not retained.</p><input className={styles.previewButton} type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setCompleteSections(false); }} /><button className={styles.previewButton} type="button" disabled={!file || busy} onClick={() => submit("preview")}>{busy ? "Reading…" : "Preview register"}</button></section>
    {preview?.alreadyAccepted ? <section className={styles.detailSection}><h3>Already imported</h3><p className={styles.detailCopy}>This exact PDF was accepted on {eventDate(preview.acceptedAt)}.</p></section> : null}
    {preview && !preview.alreadyAccepted ? <>
      <section className={styles.detailSection}><h3>Review</h3><dl className={styles.metadata}><div><dt>Generated</dt><dd>{preview.metadata.generatedLocal}</dd></div><div><dt>Through</dt><dd>{dateLabel(preview.metadata.throughDate)}</dd></div><div><dt>Sections</dt><dd>{preview.metadata.sectionCount}</dd></div><div><dt>Roster rows</dt><dd>{preview.metadata.rosterRowCount}</dd></div><div><dt>Marks</dt><dd>{preview.metadata.markCount}</dd></div><div><dt>Unmatched</dt><dd>{preview.counts.unresolved}</dd></div></dl><p className={styles.officialNote}>{preview.counts.automatic} protected-ID matches · {preview.counts.suggested} exact-name suggestions</p></section>
      <section className={styles.detailSection}><h3>Student matches</h3>{reviewRows.length ? <div className={styles.studentRows}>{reviewRows.map(matchRow)}</div> : <p className={styles.detailCopy}>No matches need review.</p>}{automaticRows.length ? <details className={styles.matchDisclosure}><summary>{automaticRows.length} protected-ID match{automaticRows.length === 1 ? "" : "es"}</summary><div className={styles.studentRows}>{automaticRows.map(matchRow)}</div></details> : null}</section>
      {preview.counts.suggested ? <section className={styles.detailSection}><label style={{ display: "flex", gap: ".5rem", fontSize: ".68rem", lineHeight: 1.4 }}><input type="checkbox" checked={acceptSuggestions} onChange={(event) => setAcceptSuggestions(event.target.checked)} />Confirm the exact legal-name suggestions shown above.</label></section> : null}
      <section className={styles.detailSection}><label style={{ display: "flex", gap: ".5rem", fontSize: ".68rem", lineHeight: 1.4 }}><input type="checkbox" checked={completeSections} onChange={(event) => setCompleteSections(event.target.checked)} />This PDF includes the full roster for each class shown.</label></section>
      <section className={styles.detailSection}><button className={styles.previewButton} type="button" disabled={busy || !completeSections || !unresolvedReady || (preview.counts.suggested > 0 && !acceptSuggestions)} onClick={() => submit("commit")}>{busy ? "Saving…" : "Accept tracking copy"}</button><p className={styles.detailCopy}>This updates school-class enrollments only. It never changes program or ensemble memberships.</p></section>
    </> : null}
  </aside>;
}

function DetailHeader({ eyebrow, title, subtitle, onClose }) {
  return <header><div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Close details">×</button></header>;
}

function Status({ tone = "plain", children }) {
  return <span className={`${styles.status} ${styles[tone]}`}>{children}</span>;
}

function ResultTable({ title, count, badge = "Current private records", children }) {
  return <div><header className={styles.resultHeader}><div><strong>{title}</strong><span>{count} result{count === 1 ? "" : "s"}</span></div><span>{badge}</span></header><div className={styles.tableWrap}>{children}</div></div>;
}

function EmptyState({ children }) {
  return <p className={styles.emptyState}>{children}</p>;
}
