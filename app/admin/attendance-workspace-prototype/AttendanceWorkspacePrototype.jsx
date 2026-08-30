"use client";

import Link from "next/link";
import { useState } from "react";
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

const ACCOMMODATED_IDS = ACTIVE.filter((student) => ["rowan-fields", "nia-grove"].includes(student.id)).map((student) => student.id);
const ADVANCED_IDS = ACTIVE.filter((student) => student.ensembles.includes("Wind Ensemble") && !ACCOMMODATED_IDS.includes(student.id)).map((student) => student.id);
const INTERMEDIATE_IDS = ACTIVE.filter((student) => !ADVANCED_IDS.includes(student.id) && !ACCOMMODATED_IDS.includes(student.id)).map((student) => student.id);

const SCHOOL_CLASSES = [
  { id: "intermediate", label: "Band Intermediate Fall", section: "BAND-INT-11", studentIds: INTERMEDIATE_IDS },
  { id: "accommodated", label: "Band Accommodated Honors Fall", section: "BAND-AH-14", studentIds: ACCOMMODATED_IDS },
  { id: "advanced", label: "Band Advanced Honors Fall", section: "BAND-ADV-12", studentIds: ADVANCED_IDS }
];

const SCHOOL_REGISTER = {
  id: "register-fall-0830",
  title: "Fall attendance register",
  generated: "Sun, Aug 30 · 5:00 AM",
  imported: "Sun, Aug 30 · 7:15 AM",
  term: "Aug 24 - Jan 15",
  throughDate: "Fri, Aug 28",
  schedule: "Main",
  pages: 15,
  classIds: SCHOOL_CLASSES.map((item) => item.id)
};

const SCHOOL_MARKS = [
  { id: "mark-01", date: "Tue, Aug 25", classId: "intermediate", studentId: "remy-cove", code: "U" },
  { id: "mark-02", date: "Tue, Aug 25", classId: "intermediate", studentId: "noah-quill", code: "T" },
  { id: "mark-03", date: "Wed, Aug 26", classId: "intermediate", studentId: "sage-linden", code: "A" },
  { id: "mark-04", date: "Wed, Aug 26", classId: "advanced", studentId: "milo-harbor", code: "U" },
  { id: "mark-05", date: "Thu, Aug 27", classId: "advanced", studentId: "avery-north", code: "T" },
  { id: "mark-06", date: "Thu, Aug 27", classId: "accommodated", studentId: "rowan-fields", code: "?" },
  { id: "mark-07", date: "Fri, Aug 28", classId: "intermediate", studentId: "remy-cove", code: "X" },
  { id: "mark-08", date: "Fri, Aug 28", classId: "advanced", studentId: "milo-harbor", code: "-" }
].filter((mark) => BY_ID.has(mark.studentId) && SCHOOL_CLASSES.some((item) => item.id === mark.classId && item.studentIds.includes(mark.studentId)));

const SCHOOL_CODES = {
  T: "Tardy",
  A: "Absent excused",
  U: "Absent unexcused",
  "?": "Absent unknown",
  X: "Absent exempt",
  "-": "Off roll"
};

const ABSENCE_CODES = new Set(["A", "U", "?"]);
const PROGRAM_VIEWS = [["events", "Events"], ["ready", "Needs attendance"], ["concerns", "Student concerns"]];
const SCHOOL_VIEWS = [["registers", "Registers"], ["classes", "Classes"], ["absent", "Absences"], ["tardy", "Tardies"]];

function schoolClass(value) {
  const classId = typeof value === "string" ? value : value.classId;
  return SCHOOL_CLASSES.find((item) => item.id === classId);
}

function schoolMarksForStudent(studentId) {
  return SCHOOL_MARKS.filter((mark) => mark.studentId === studentId);
}

function schoolSelection(selectionId) {
  if (selectionId === "school-import") return { kind: "import" };
  if (selectionId === SCHOOL_REGISTER.id) return { kind: "register", register: SCHOOL_REGISTER };
  const klass = SCHOOL_CLASSES.find((item) => `class-${item.id}` === selectionId);
  return klass ? { kind: "class", klass } : null;
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

export default function AttendanceWorkspacePrototype({ initialSource = "program", initialView = "", initialStudentId = "", initialSessionId = "" }) {
  const safeSource = initialSource === "school" ? "school" : "program";
  const safeStudent = BY_ID.has(initialStudentId) ? initialStudentId : "";
  const views = safeSource === "program" ? PROGRAM_VIEWS : SCHOOL_VIEWS;
  const safeView = views.some(([value]) => value === initialView) ? initialView : views[0][0];
  const [source, setSource] = useState(safeSource);
  const [view, setView] = useState(safeView);
  const [studentId, setStudentId] = useState(safeStudent);
  const [selectionId, setSelectionId] = useState(initialSessionId);
  const [search, setSearch] = useState("");

  const student = BY_ID.get(studentId) || null;
  const selectedProgramEvent = source === "program" ? PROGRAM_EVENTS.find((event) => event.id === selectionId) : null;
  const selectedSchoolItem = source === "school" ? schoolSelection(selectionId) : null;
  const hasDetail = Boolean(selectedProgramEvent || selectedSchoolItem);

  function writeLocation(next = {}) {
    const values = { source, view, student: studentId, session: selectionId, ...next };
    const params = new URLSearchParams();
    if (values.source !== "program") params.set("source", values.source);
    const defaultView = values.source === "program" ? "events" : "registers";
    if (values.view && values.view !== defaultView) params.set("view", values.view);
    if (values.student) params.set("student", values.student);
    if (values.session) params.set("session", values.session);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }

  function chooseSource(nextSource) {
    const nextView = nextSource === "program" ? "events" : "registers";
    setSource(nextSource); setView(nextView); setSelectionId(""); setSearch("");
    writeLocation({ source: nextSource, view: nextView, session: "" });
  }

  function chooseView(nextView) {
    setView(nextView); setSelectionId("");
    writeLocation({ view: nextView, session: "" });
  }

  function chooseSelection(nextSelectionId) {
    setSelectionId(nextSelectionId);
    writeLocation({ session: nextSelectionId });
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId); setSelectionId("");
    writeLocation({ student: nextStudentId, session: "" });
  }

  function clearStudent() {
    setStudentId(""); setSelectionId("");
    writeLocation({ student: "", session: "" });
  }

  const currentViews = source === "program" ? PROGRAM_VIEWS : SCHOOL_VIEWS;
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
        <div><strong>{source === "program" ? "Taken in AshleyBands" : "Imported from Infinite Campus"}</strong><span>{source === "program" ? "Concerts, rehearsals, games, trips, and other events." : "The PDF is a tracking copy. Infinite Campus remains official."}</span></div>
        {source === "school" ? <button className={styles.importAction} onClick={() => chooseSelection("school-import")}>Import register</button> : null}
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
          <div><span>Registers</span><strong>1</strong></div>
          <div><span>Class sections</span><strong>{SCHOOL_CLASSES.length}</strong></div>
          <div><span>Official marks</span><strong className={styles.warnText}>{SCHOOL_MARKS.length}</strong></div>
          <p>Through {SCHOOL_REGISTER.throughDate} · generated {SCHOOL_REGISTER.generated}</p>
        </>}
      </section>

      <div className={[styles.workspace, hasDetail ? styles.withDetail : ""].filter(Boolean).join(" ")}>
        <aside className={styles.filters}>
          <div className={styles.filterHeading}><strong>{student ? "This student" : "Questions"}</strong></div>
          <div className={styles.viewButtons}>{currentViews.map(([value, label]) => <button key={value} className={view === value ? styles.activeView : ""} onClick={() => chooseView(value)}>{label}</button>)}</div>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={source === "program" ? "Event or group..." : "Class, student, or code..."} /></label>
          <p className={styles.filterNote}>{source === "program" ? "Switch sources above. Their totals never merge." : "Blank or future cells are never counted as present."}</p>
        </aside>

        <section className={styles.resultsPanel}>
          {student
            ? <StudentAttendance source={source} student={student} onSelection={chooseSelection} />
            : source === "program"
              ? <ProgramResults view={view} search={search} onSelection={chooseSelection} onStudent={scopeStudent} />
              : <SchoolResults view={view} search={search} onSelection={chooseSelection} onStudent={scopeStudent} />}
        </section>

        {selectedProgramEvent ? <ProgramEventDetail event={selectedProgramEvent} onClose={() => chooseSelection("")} onStudent={scopeStudent} /> : null}
        {selectedSchoolItem ? <SchoolDetail selection={selectedSchoolItem} onClose={() => chooseSelection("")} onSelection={chooseSelection} onStudent={scopeStudent} /> : null}
      </div>
    </main>
  );
}

function ProgramResults({ view, search, onSelection, onStudent }) {
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
    return <tr key={event.id}><td><strong>{event.date}</strong></td><td>{event.title}<small>{event.kind}</small></td><td>{event.group}</td><td><EventState state={event.state} /></td><td>{event.state === "complete" ? `${counts.present} P · ${counts.tardy} T · ${counts.absent} A` : `${event.studentIds.length} students`}</td><td><button className={styles.rowAction} onClick={() => onSelection(event.id)}>Open session</button></td></tr>;
  })}</tbody></table></ResultTable>;
}

function SchoolResults({ view, search, onSelection, onStudent }) {
  const term = search.trim().toLowerCase();
  if (view === "registers") {
    const matches = !term || [SCHOOL_REGISTER.title, SCHOOL_REGISTER.term, SCHOOL_REGISTER.generated].join(" ").toLowerCase().includes(term);
    return <ResultTable title="Imported Infinite Campus registers" count={matches ? 1 : 0}>{matches ? <table><thead><tr><th>Generated</th><th>Term</th><th>Sections</th><th>Through</th><th>Marks</th><th></th></tr></thead><tbody><tr><td><strong>{SCHOOL_REGISTER.generated}</strong><small>Imported {SCHOOL_REGISTER.imported}</small></td><td>{SCHOOL_REGISTER.term}</td><td>{SCHOOL_REGISTER.classIds.length}</td><td>{SCHOOL_REGISTER.throughDate}</td><td>{SCHOOL_MARKS.length}</td><td><button className={styles.rowAction} onClick={() => onSelection(SCHOOL_REGISTER.id)}>Open register</button></td></tr></tbody></table> : <EmptyState>No matching registers.</EmptyState>}</ResultTable>;
  }

  if (view === "classes") {
    const rows = SCHOOL_CLASSES.filter((klass) => !term || [klass.label, klass.section].join(" ").toLowerCase().includes(term));
    return <ResultTable title="Class sections in latest register" count={rows.length}><table><thead><tr><th>Class</th><th>Section</th><th>Roster</th><th>Official marks</th><th>Source</th><th></th></tr></thead><tbody>{rows.map((klass) => {
      const marks = SCHOOL_MARKS.filter((mark) => mark.classId === klass.id);
      return <tr key={klass.id}><td><strong>{klass.label}</strong></td><td>{klass.section}</td><td>{klass.studentIds.length}</td><td>{marks.length}</td><td><Status tone="source">Infinite Campus</Status></td><td><button className={styles.rowAction} onClick={() => onSelection(`class-${klass.id}`)}>Open class</button></td></tr>;
    })}</tbody></table></ResultTable>;
  }

  const marks = SCHOOL_MARKS.filter((mark) => view === "tardy" ? mark.code === "T" : ABSENCE_CODES.has(mark.code)).map((mark) => ({ ...mark, student: BY_ID.get(mark.studentId), klass: schoolClass(mark) })).filter((mark) => !term || [mark.student.displayName, mark.klass.label, mark.code, SCHOOL_CODES[mark.code]].join(" ").toLowerCase().includes(term));
  return <ResultTable title={view === "tardy" ? "School-day tardies" : "School-day absences"} count={marks.length}><table><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Code</th><th>Official meaning</th><th></th></tr></thead><tbody>{marks.map((mark) => <tr key={mark.id}><td><strong>{mark.date}</strong></td><td>{mark.student.displayName}</td><td>{mark.klass.label}</td><td><Status tone={schoolCodeTone(mark.code)}>{mark.code}</Status></td><td>{SCHOOL_CODES[mark.code]}</td><td><button className={styles.rowAction} onClick={() => onStudent(mark.studentId)}>Open student</button></td></tr>)}</tbody></table></ResultTable>;
}

function StudentAttendance({ source, student, onSelection }) {
  if (source === "program") {
    const events = PROGRAM_EVENTS.filter((event) => event.studentIds.includes(student.id));
    const [present, total] = student.attendance;
    return <><StudentSummary label="Program events" first={`${present} of ${total} present`} second={`${total - present} missed`} source="AshleyBands" />
      <ResultTable title="Recent program events" count={events.length}><table><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Status</th><th></th></tr></thead><tbody>{events.map((event) => {
        const status = studentStatus(event, student.id);
        return <tr key={event.id}><td><strong>{event.date}</strong></td><td>{event.title}</td><td>{event.group}</td><td><AttendanceStatus status={status} /></td><td><button className={styles.rowAction} onClick={() => onSelection(event.id)}>Open event</button></td></tr>;
      })}</tbody></table></ResultTable></>;
  }

  const marks = schoolMarksForStudent(student.id);
  const absences = marks.filter((mark) => ABSENCE_CODES.has(mark.code)).length;
  const tardies = marks.filter((mark) => mark.code === "T").length;
  return <><StudentSummary label="School day" first={`${absences} absence mark${absences === 1 ? "" : "s"}`} second={`${tardies} tardy mark${tardies === 1 ? "" : "s"}`} source="Infinite Campus" />
    <ResultTable title="Official marks in latest register" count={marks.length}>{marks.length ? <table><thead><tr><th>Date</th><th>Class</th><th>Code</th><th>Official meaning</th><th>Source</th></tr></thead><tbody>{marks.map((mark) => <tr key={mark.id}><td><strong>{mark.date}</strong></td><td>{schoolClass(mark).label}</td><td><Status tone={schoolCodeTone(mark.code)}>{mark.code}</Status></td><td>{SCHOOL_CODES[mark.code]}</td><td>Infinite Campus</td></tr>)}</tbody></table> : <EmptyState>No official exception marks in the latest register.</EmptyState>}</ResultTable></>;
}

function StudentSummary({ label, first, second, source }) {
  return <section className={styles.studentSummary}><div><span>{label}</span><strong>{source}</strong></div><div><span>Latest register</span><strong>{first}</strong></div><div><span>Additional signal</span><strong>{second}</strong></div></section>;
}

function ProgramEventDetail({ event, onClose, onStudent }) {
  const counts = countsFor(event, event.studentIds);
  return <aside className={styles.detail} aria-label={`${event.title} attendance details`}>
    <DetailHeader eyebrow="AshleyBands record" title={event.title} subtitle={event.date} onClose={onClose} />
    <section className={styles.detailSection}><h3>Summary</h3><div className={styles.detailCounts}><div><strong>{counts.present}</strong><span>Present</span></div><div><strong>{counts.tardy}</strong><span>Tardy</span></div><div><strong>{counts.absent}</strong><span>Absent</span></div><div><strong>{counts.unmarked}</strong><span>Unmarked</span></div></div><Link className={styles.liveLink} href="/attendance">Open live attendance tool →</Link></section>
    <section className={styles.detailSection}><h3>Students</h3><div className={styles.studentRows}>{event.studentIds.map((id) => {
      const student = BY_ID.get(id);
      return <button key={id} onClick={() => onStudent(id)}><span><strong>{student.displayName}</strong><small>{student.programInstrument}</small></span><AttendanceStatus status={studentStatus(event, id)} /></button>;
    })}</div></section>
  </aside>;
}

function SchoolDetail({ selection, onClose, onSelection, onStudent }) {
  if (selection.kind === "import") {
    return <aside className={styles.detail} aria-label="Import Infinite Campus register">
      <DetailHeader eyebrow="Future workflow preview" title="Import register" subtitle="Infinite Campus PDF" onClose={onClose} />
      <section className={styles.detailSection}><h3>One report</h3><p className={styles.detailCopy}>Use the Attendance Register PDF you already generate.</p><div className={styles.importSteps}><div><strong>1</strong><span>Choose PDF</span></div><div><strong>2</strong><span>Match students and sections</span></div><div><strong>3</strong><span>Review official marks</span></div><div><strong>4</strong><span>Save private tracking copy</span></div></div><button className={styles.previewButton} type="button">Choose PDF (prototype)</button></section>
      <section className={styles.detailSection}><h3>Import rules</h3><ul className={styles.ruleList}><li>Match students by district student number.</li><li>Retain the original Infinite Campus code.</li><li>Never count blank or future cells as present.</li><li>Flag unmatched students or sections for review.</li></ul></section>
    </aside>;
  }

  if (selection.kind === "register") {
    const register = selection.register;
    return <aside className={styles.detail} aria-label="Infinite Campus register details">
      <DetailHeader eyebrow="Infinite Campus tracking copy" title={register.title} subtitle={`Generated ${register.generated}`} onClose={onClose} />
      <section className={styles.detailSection}><h3>Source</h3><dl className={styles.metadata}><div><dt>Term</dt><dd>{register.term}</dd></div><div><dt>Through</dt><dd>{register.throughDate}</dd></div><div><dt>Schedule</dt><dd>{register.schedule}</dd></div><div><dt>Pages</dt><dd>{register.pages}</dd></div><div><dt>Imported</dt><dd>{register.imported}</dd></div><div><dt>Official marks</dt><dd>{SCHOOL_MARKS.length}</dd></div></dl><p className={styles.officialNote}>Official record · Infinite Campus</p></section>
      <section className={styles.detailSection}><h3>Class sections</h3><div className={styles.studentRows}>{SCHOOL_CLASSES.map((klass) => <button key={klass.id} onClick={() => onSelection(`class-${klass.id}`)}><span><strong>{klass.label}</strong><small>{klass.section}</small></span><Status tone="plain">{klass.studentIds.length} students</Status></button>)}</div></section>
      <SchoolCodeLegend />
    </aside>;
  }

  const klass = selection.klass;
  const marks = SCHOOL_MARKS.filter((mark) => mark.classId === klass.id);
  return <aside className={styles.detail} aria-label={`${klass.label} register details`}>
    <DetailHeader eyebrow="Infinite Campus class section" title={klass.label} subtitle={klass.section} onClose={onClose} />
    <section className={styles.detailSection}><h3>Latest register</h3><dl className={styles.metadata}><div><dt>Roster</dt><dd>{klass.studentIds.length}</dd></div><div><dt>Official marks</dt><dd>{marks.length}</dd></div><div><dt>Through</dt><dd>{SCHOOL_REGISTER.throughDate}</dd></div><div><dt>Source</dt><dd>Infinite Campus</dd></div></dl></section>
    <section className={styles.detailSection}><h3>Official marks</h3>{marks.length ? <div className={styles.studentRows}>{marks.map((mark) => {
      const student = BY_ID.get(mark.studentId);
      return <button key={mark.id} onClick={() => onStudent(mark.studentId)}><span><strong>{student.displayName}</strong><small>{mark.date} · {SCHOOL_CODES[mark.code]}</small></span><Status tone={schoolCodeTone(mark.code)}>{mark.code}</Status></button>;
    })}</div> : <p className={styles.detailCopy}>No official exception marks in this register.</p>}</section>
    <SchoolCodeLegend />
  </aside>;
}

function SchoolCodeLegend() {
  return <section className={styles.detailSection}><h3>Codes retained</h3><div className={styles.codeLegend}>{Object.entries(SCHOOL_CODES).map(([code, label]) => <div key={code}><Status tone={schoolCodeTone(code)}>{code}</Status><span>{label}</span></div>)}</div></section>;
}

function DetailHeader({ eyebrow, title, subtitle, onClose }) {
  return <header><div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Close attendance details">×</button></header>;
}

function ResultTable({ title, count, children }) {
  return <div><header className={styles.resultHeader}><div><strong>{title}</strong><span>{count} result{count === 1 ? "" : "s"}</span></div><span>Read-only prototype</span></header><div className={styles.tableWrap}>{children}</div></div>;
}

function EmptyState({ children }) {
  return <p className={styles.emptyState}>{children}</p>;
}

function EventState({ state }) {
  const labels = { complete: "Complete", ready: "Ready to take", upcoming: "Upcoming", setup: "Setup needed" };
  return <Status tone={state === "complete" ? "good" : state === "upcoming" ? "plain" : "warn"}>{labels[state]}</Status>;
}

function AttendanceStatus({ status }) {
  const labels = { present: "Present", tardy: "Tardy", absent: "Absent", unmarked: "Unmarked" };
  return <Status tone={status === "present" ? "good" : status === "unmarked" ? "plain" : "warn"}>{labels[status]}</Status>;
}

function schoolCodeTone(code) {
  if (code === "A" || code === "X") return "source";
  if (code === "-") return "plain";
  return "warn";
}

function Status({ tone, children }) {
  return <span className={[styles.status, styles[tone]].join(" ")}>{children}</span>;
}
