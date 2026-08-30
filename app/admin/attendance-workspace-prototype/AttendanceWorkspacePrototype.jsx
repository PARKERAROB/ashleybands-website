"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STUDENTS } from "../current-students-prototype/CurrentStudentsPrototype";
import styles from "./attendance-workspace-prototype.module.css";

const ACTIVE = STUDENTS.filter((student) => student.status === "active");
const BY_ID = new Map(ACTIVE.map((student) => [student.id, student]));
const MARCHING_IDS = ACTIVE.filter((student) => student.ensembles.includes("Marching Band")).map((student) => student.id);
const ALL_IDS = ACTIVE.map((student) => student.id);

const PROGRAM_EVENTS = [
  {
    id: "program-0825", date: "Tue, Aug 25", title: "Marching rehearsal", group: "Marching Band", kind: "Rehearsal",
    state: "complete", studentIds: MARCHING_IDS, statusById: { "sage-linden": "absent", "noah-quill": "tardy" }
  },
  {
    id: "program-0827", date: "Thu, Aug 27", title: "Marching rehearsal", group: "Marching Band", kind: "Rehearsal",
    state: "complete", studentIds: MARCHING_IDS, statusById: { "rowan-fields": "absent" }
  },
  {
    id: "program-0828", date: "Fri, Aug 28", title: "Football vs. EE Smith", group: "Marching Band", kind: "Football",
    state: "complete", studentIds: MARCHING_IDS, statusById: { "noah-quill": "tardy" }
  },
  {
    id: "program-0901", date: "Tue, Sep 1", title: "Marching rehearsal", group: "Marching Band", kind: "Rehearsal",
    state: "ready", studentIds: MARCHING_IDS, statusById: {}
  },
  {
    id: "program-0911", date: "Fri, Sep 11", title: "Football vs. Fike", group: "Marching Band", kind: "Football",
    state: "upcoming", studentIds: MARCHING_IDS, statusById: {}
  },
  {
    id: "program-1008", date: "Thu, Oct 8", title: "Fall concert", group: "Wind + Concert", kind: "Concert",
    state: "setup", studentIds: ALL_IDS, statusById: {}
  },
  {
    id: "program-1020", date: "Tue, Oct 20", title: "NHCS Marching Band Showcase", group: "Marching Band", kind: "Other event",
    state: "upcoming", studentIds: MARCHING_IDS, statusById: {}
  }
];

const SCHOOL_CLASSES = [
  { id: "concert", label: "1st Period · Concert Band", studentIds: ACTIVE.filter((student) => student.ensembles.includes("Concert Band")).map((student) => student.id) },
  { id: "percussion", label: "2nd Period · Percussion Ensemble", studentIds: ["rowan-fields"] },
  { id: "wind", label: "4th Period · Wind Ensemble", studentIds: ACTIVE.filter((student) => student.ensembles.includes("Wind Ensemble") && student.id !== "rowan-fields").map((student) => student.id) }
];

const SCHOOL_REPORTS = [
  { id: "school-0826-concert", date: "Wed, Aug 26", classId: "concert", statusById: { "remy-cove": "absent" } },
  { id: "school-0826-percussion", date: "Wed, Aug 26", classId: "percussion", statusById: {} },
  { id: "school-0826-wind", date: "Wed, Aug 26", classId: "wind", statusById: { "milo-harbor": "tardy" } },
  { id: "school-0827-concert", date: "Thu, Aug 27", classId: "concert", statusById: { "noah-quill": "absent" } },
  { id: "school-0827-percussion", date: "Thu, Aug 27", classId: "percussion", statusById: {} },
  { id: "school-0827-wind", date: "Thu, Aug 27", classId: "wind", statusById: {} },
  { id: "school-0828-concert", date: "Fri, Aug 28", classId: "concert", statusById: { "sage-linden": "tardy" } },
  { id: "school-0828-percussion", date: "Fri, Aug 28", classId: "percussion", statusById: { "rowan-fields": "absent" } },
  { id: "school-0828-wind", date: "Fri, Aug 28", classId: "wind", statusById: { "avery-north": "tardy" } }
];

const PROGRAM_VIEWS = [["events", "Events"], ["ready", "Needs attendance"], ["concerns", "Student concerns"]];
const SCHOOL_VIEWS = [["reports", "Daily reports"], ["absent", "Absences"], ["tardy", "Tardies"]];

function schoolClass(report) {
  return SCHOOL_CLASSES.find((item) => item.id === report.classId);
}

function studentStatus(session, studentId) {
  if (session.state && session.state !== "complete") return "unmarked";
  return session.statusById[studentId] || "present";
}

function countsFor(session, studentIds) {
  return studentIds.reduce((counts, id) => {
    const status = studentStatus(session, id);
    counts[status] += 1;
    return counts;
  }, { present: 0, tardy: 0, absent: 0, unmarked: 0 });
}

function schoolRowsForStudent(studentId) {
  return SCHOOL_REPORTS.filter((report) => schoolClass(report).studentIds.includes(studentId));
}

function schoolSummary(studentId) {
  const reports = schoolRowsForStudent(studentId);
  return reports.reduce((summary, report) => {
    summary.total += 1;
    summary[studentStatus({ ...report, state: "complete" }, studentId)] += 1;
    return summary;
  }, { total: 0, present: 0, tardy: 0, absent: 0, unmarked: 0 });
}

export default function AttendanceWorkspacePrototype({ initialSource = "program", initialView = "", initialStudentId = "", initialSessionId = "" }) {
  const safeSource = initialSource === "school" ? "school" : "program";
  const safeStudent = BY_ID.has(initialStudentId) ? initialStudentId : "";
  const views = safeSource === "program" ? PROGRAM_VIEWS : SCHOOL_VIEWS;
  const safeView = views.some(([value]) => value === initialView) ? initialView : views[0][0];
  const [source, setSource] = useState(safeSource);
  const [view, setView] = useState(safeView);
  const [studentId, setStudentId] = useState(safeStudent);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [search, setSearch] = useState("");

  const student = BY_ID.get(studentId) || null;
  const selectedSession = source === "program"
    ? PROGRAM_EVENTS.find((event) => event.id === sessionId)
    : SCHOOL_REPORTS.find((report) => report.id === sessionId);

  function writeLocation(next = {}) {
    const values = { source, view, student: studentId, session: sessionId, ...next };
    const params = new URLSearchParams();
    if (values.source !== "program") params.set("source", values.source);
    const defaultView = values.source === "program" ? "events" : "reports";
    if (values.view && values.view !== defaultView) params.set("view", values.view);
    if (values.student) params.set("student", values.student);
    if (values.session) params.set("session", values.session);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }

  function chooseSource(nextSource) {
    const nextView = nextSource === "program" ? "events" : "reports";
    setSource(nextSource); setView(nextView); setSessionId(""); setSearch("");
    writeLocation({ source: nextSource, view: nextView, session: "" });
  }

  function chooseView(nextView) {
    setView(nextView); setSessionId("");
    writeLocation({ view: nextView, session: "" });
  }

  function chooseSession(nextSessionId) {
    setSessionId(nextSessionId);
    writeLocation({ session: nextSessionId });
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId); setSessionId("");
    writeLocation({ student: nextStudentId, session: "" });
  }

  function clearStudent() {
    setStudentId(""); setSessionId("");
    writeLocation({ student: "", session: "" });
  }

  const currentViews = source === "program" ? PROGRAM_VIEWS : SCHOOL_VIEWS;
  const schoolExceptionCount = SCHOOL_REPORTS.reduce((total, report) => total + Object.keys(report.statusById).length, 0);
  const programIncompleteCount = PROGRAM_EVENTS.filter((event) => event.state === "ready" || event.state === "setup").length;

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav><Link href="/admin/operations-prototype">Command center</Link><Link href="/attendance">Live attendance tool</Link><span className={styles.prototypeBadge}>Prototype · Synthetic data</span></nav>
      </header>

      <section className={styles.heading}>
        <div><p className={styles.eyebrow}>Current operations</p><h1>Attendance</h1><p>Two sources. One connected student record.</p></div>
        <div className={styles.sourceSwitch} aria-label="Attendance source">
          <button className={source === "program" ? styles.activeSource : ""} onClick={() => chooseSource("program")}><strong>Program Events</strong><span>AshleyBands record</span></button>
          <button className={source === "school" ? styles.activeSource : ""} onClick={() => chooseSource("school")}><strong>School Day</strong><span>Infinite Campus official</span></button>
        </div>
      </section>

      <section className={styles.sourceRule} data-source={source}>
        <strong>{source === "program" ? "Taken in AshleyBands" : "Reported in Infinite Campus"}</strong>
        <span>{source === "program" ? "Concerts, rehearsals, games, trips, and other events." : "AshleyBands keeps a tracking copy. Infinite Campus remains official."}</span>
      </section>

      {student ? <section className={styles.scopeBar}>
        <div><span>Student context</span><strong>{student.displayName}</strong><p>Both attendance sources remain separate.</p></div>
        <div><Link href={`/admin/current-students-prototype?student=${encodeURIComponent(student.id)}`}>Open full student</Link><button onClick={clearStudent}>Show full program</button></div>
      </section> : null}

      <section className={styles.signalBar}>
        {source === "program" ? <>
          <div><span>Sessions shown</span><strong>{PROGRAM_EVENTS.length}</strong></div>
          <div><span>Need action</span><strong className={styles.warnText}>{programIncompleteCount}</strong></div>
          <p>Outside the normal school day</p>
        </> : <>
          <div><span>Reports tracked</span><strong>{SCHOOL_REPORTS.length}</strong></div>
          <div><span>Absence / tardy marks</span><strong className={styles.warnText}>{schoolExceptionCount}</strong></div>
          <p>Official source · Infinite Campus</p>
        </>}
      </section>

      <div className={[styles.workspace, selectedSession ? styles.withDetail : ""].filter(Boolean).join(" ")}>
        <aside className={styles.filters}>
          <div className={styles.filterHeading}><strong>{student ? "This student" : "Questions"}</strong></div>
          <div className={styles.viewButtons}>{currentViews.map(([value, label]) => <button key={value} className={view === value ? styles.activeView : ""} onClick={() => chooseView(value)}>{label}</button>)}</div>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={source === "program" ? "Event or group..." : "Class or student..."} /></label>
          <p className={styles.filterNote}>Switch sources above. Their totals never merge.</p>
        </aside>

        <section className={styles.resultsPanel}>
          {student
            ? <StudentAttendance source={source} student={student} onSession={chooseSession} />
            : source === "program"
              ? <ProgramResults view={view} search={search} onSession={chooseSession} onStudent={scopeStudent} />
              : <SchoolResults view={view} search={search} onSession={chooseSession} onStudent={scopeStudent} />}
        </section>

        {selectedSession ? <SessionDetail source={source} session={selectedSession} onClose={() => chooseSession("")} onStudent={scopeStudent} /> : null}
      </div>
    </main>
  );
}

function ProgramResults({ view, search, onSession, onStudent }) {
  const term = search.trim().toLowerCase();
  if (view === "concerns") {
    const rows = ACTIVE.filter((student) => {
      const rate = student.attendance[0] / student.attendance[1];
      return (rate < .9 || student.attendance[1] - student.attendance[0] >= 2) && (!term || student.displayName.toLowerCase().includes(term));
    });
    return <ResultTable title="Program-event concerns" count={rows.length}><table><thead><tr><th>Student</th><th>Present</th><th>Missed</th><th>Rate</th><th></th></tr></thead><tbody>{rows.map((student) => {
      const missed = student.attendance[1] - student.attendance[0];
      const rate = Math.round(student.attendance[0] / student.attendance[1] * 100);
      return <tr key={student.id}><td><strong>{student.displayName}</strong></td><td>{student.attendance[0]} of {student.attendance[1]}</td><td>{missed}</td><td><Status tone={rate < 90 ? "warn" : "good"}>{rate}%</Status></td><td><button className={styles.rowAction} onClick={() => onStudent(student.id)}>Open attendance</button></td></tr>;
    })}</tbody></table></ResultTable>;
  }

  const events = PROGRAM_EVENTS.filter((event) => {
    if (view === "ready" && event.state !== "ready" && event.state !== "setup") return false;
    return !term || [event.title, event.group, event.kind].join(" ").toLowerCase().includes(term);
  });
  return <ResultTable title={view === "ready" ? "Needs attendance action" : "Program events"} count={events.length}><table><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Status</th><th>Results</th><th></th></tr></thead><tbody>{events.map((event) => {
    const counts = countsFor(event, event.studentIds);
    return <tr key={event.id}><td><strong>{event.date}</strong></td><td>{event.title}<small>{event.kind}</small></td><td>{event.group}</td><td><EventState state={event.state} /></td><td>{event.state === "complete" ? `${counts.present} P · ${counts.tardy} T · ${counts.absent} A` : `${event.studentIds.length} students`}</td><td><button className={styles.rowAction} onClick={() => onSession(event.id)}>Open session</button></td></tr>;
  })}</tbody></table></ResultTable>;
}

function SchoolResults({ view, search, onSession, onStudent }) {
  const term = search.trim().toLowerCase();
  if (view === "absent" || view === "tardy") {
    const rows = SCHOOL_REPORTS.flatMap((report) => Object.entries(report.statusById)
      .filter(([, status]) => status === view)
      .map(([studentId, status]) => ({ report, student: BY_ID.get(studentId), status })))
      .filter((row) => !term || [row.student.displayName, schoolClass(row.report).label].join(" ").toLowerCase().includes(term));
    return <ResultTable title={view === "absent" ? "School-day absences" : "School-day tardies"} count={rows.length}><table><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Official status</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.report.id + row.student.id}><td><strong>{row.report.date}</strong></td><td>{row.student.displayName}</td><td>{schoolClass(row.report).label}</td><td><Status tone="warn">{row.status === "absent" ? "Absent" : "Tardy"}</Status></td><td><button className={styles.rowAction} onClick={() => onStudent(row.student.id)}>Open student</button></td></tr>)}</tbody></table></ResultTable>;
  }

  const reports = SCHOOL_REPORTS.filter((report) => !term || schoolClass(report).label.toLowerCase().includes(term));
  return <ResultTable title="Infinite Campus tracking copy" count={reports.length}><table><thead><tr><th>Date</th><th>Class</th><th>Source</th><th>Roster</th><th>Absence / tardy</th><th></th></tr></thead><tbody>{reports.map((report) => {
    const klass = schoolClass(report);
    const counts = countsFor({ ...report, state: "complete" }, klass.studentIds);
    return <tr key={report.id}><td><strong>{report.date}</strong></td><td>{klass.label}</td><td><Status tone="source">Infinite Campus</Status></td><td>{klass.studentIds.length}</td><td>{counts.absent} absent · {counts.tardy} tardy</td><td><button className={styles.rowAction} onClick={() => onSession(report.id)}>Open report</button></td></tr>;
  })}</tbody></table></ResultTable>;
}

function StudentAttendance({ source, student, onSession }) {
  if (source === "program") {
    const events = PROGRAM_EVENTS.filter((event) => event.studentIds.includes(student.id));
    const [present, total] = student.attendance;
    return <><StudentSummary label="Program events" first={`${present} of ${total} present`} second={`${total - present} missed`} source="AshleyBands" />
      <ResultTable title="Recent program events" count={events.length}><table><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Status</th><th></th></tr></thead><tbody>{events.map((event) => {
        const status = studentStatus(event, student.id);
        return <tr key={event.id}><td><strong>{event.date}</strong></td><td>{event.title}</td><td>{event.group}</td><td><AttendanceStatus status={status} /></td><td><button className={styles.rowAction} onClick={() => onSession(event.id)}>Open event</button></td></tr>;
      })}</tbody></table></ResultTable></>;
  }
  const reports = schoolRowsForStudent(student.id);
  const summary = schoolSummary(student.id);
  return <><StudentSummary label="School day" first={`${summary.absent} absent`} second={`${summary.tardy} tardy`} source="Infinite Campus" />
    <ResultTable title="School-day tracking copy" count={reports.length}><table><thead><tr><th>Date</th><th>Class</th><th>Official status</th><th>Source</th><th></th></tr></thead><tbody>{reports.map((report) => {
      const status = studentStatus({ ...report, state: "complete" }, student.id);
      return <tr key={report.id}><td><strong>{report.date}</strong></td><td>{schoolClass(report).label}</td><td><AttendanceStatus status={status} /></td><td>Infinite Campus</td><td><button className={styles.rowAction} onClick={() => onSession(report.id)}>Open report</button></td></tr>;
    })}</tbody></table></ResultTable></>;
}

function StudentSummary({ label, first, second, source }) {
  return <section className={styles.studentSummary}><div><span>{label}</span><strong>{source}</strong></div><div><span>Current summary</span><strong>{first}</strong></div><div><span>Additional signal</span><strong>{second}</strong></div></section>;
}

function SessionDetail({ source, session, onClose, onStudent }) {
  const isProgram = source === "program";
  const klass = isProgram ? null : schoolClass(session);
  const studentIds = isProgram ? session.studentIds : klass.studentIds;
  const normalizedSession = isProgram ? session : { ...session, state: "complete" };
  const counts = countsFor(normalizedSession, studentIds);
  return <aside className={styles.detail} aria-label={`${isProgram ? session.title : klass.label} attendance details`}>
    <header><div><span>{isProgram ? "AshleyBands record" : "Infinite Campus tracking copy"}</span><h2>{isProgram ? session.title : klass.label}</h2><p>{session.date}</p></div><button onClick={onClose} aria-label="Close attendance details">×</button></header>
    <section className={styles.detailSection}><h3>Summary</h3><div className={styles.detailCounts}><div><strong>{counts.present}</strong><span>Present</span></div><div><strong>{counts.tardy}</strong><span>Tardy</span></div><div><strong>{counts.absent}</strong><span>Absent</span></div><div><strong>{counts.unmarked}</strong><span>Unmarked</span></div></div>{isProgram ? <Link className={styles.liveLink} href="/attendance">Open live attendance tool →</Link> : <p className={styles.officialNote}>Official record · Infinite Campus</p>}</section>
    <section className={styles.detailSection}><h3>Students</h3><div className={styles.studentRows}>{studentIds.map((id) => {
      const student = BY_ID.get(id);
      const status = studentStatus(normalizedSession, id);
      return <button key={id} onClick={() => onStudent(id)}><span><strong>{student.displayName}</strong><small>{student.programInstrument}</small></span><AttendanceStatus status={status} /></button>;
    })}</div></section>
  </aside>;
}

function ResultTable({ title, count, children }) {
  return <div><header className={styles.resultHeader}><div><strong>{title}</strong><span>{count} result{count === 1 ? "" : "s"}</span></div><span>Read-only prototype</span></header><div className={styles.tableWrap}>{children}</div></div>;
}

function EventState({ state }) {
  const labels = { complete: "Complete", ready: "Ready to take", upcoming: "Upcoming", setup: "Setup needed" };
  return <Status tone={state === "complete" ? "good" : state === "upcoming" ? "plain" : "warn"}>{labels[state]}</Status>;
}

function AttendanceStatus({ status }) {
  const labels = { present: "Present", tardy: "Tardy", absent: "Absent", unmarked: "Unmarked" };
  return <Status tone={status === "present" ? "good" : status === "unmarked" ? "plain" : "warn"}>{labels[status]}</Status>;
}

function Status({ tone, children }) {
  return <span className={[styles.status, styles[tone]].join(" ")}>{children}</span>;
}
