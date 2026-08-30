"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STUDENTS } from "../current-students-prototype/CurrentStudentsPrototype";
import styles from "./ensembles-memberships-prototype.module.css";

const ALL = "all";
const ACTIVE = STUDENTS.filter((student) => student.status === "active");
const BY_ID = new Map(ACTIVE.map((student) => [student.id, student]));
const TRIP_IDS = new Set(["avery-north", "milo-harbor", "rowan-fields", "theo-marin", "lena-vale", "remy-cove"]);

const ACCOMMODATED_IDS = ACTIVE.filter((student) => ["rowan-fields", "nia-grove"].includes(student.id)).map((student) => student.id);
const ADVANCED_IDS = ACTIVE.filter((student) => student.ensembles.includes("Wind Ensemble") && !ACCOMMODATED_IDS.includes(student.id)).map((student) => student.id);
const INTERMEDIATE_IDS = ACTIVE.filter((student) => !ADVANCED_IDS.includes(student.id) && !ACCOMMODATED_IDS.includes(student.id)).map((student) => student.id);

const SCHOOL_CLASSES = [
  { id: "intermediate", name: "Band Intermediate Fall", section: "BAND-INT-11", expectedGroup: "Concert Band", studentIds: INTERMEDIATE_IDS },
  { id: "accommodated", name: "Band Accommodated Honors Fall", section: "BAND-AH-14", expectedGroup: "Staff review", studentIds: ACCOMMODATED_IDS },
  { id: "advanced", name: "Band Advanced Honors Fall", section: "BAND-ADV-12", expectedGroup: "Wind Ensemble", studentIds: ADVANCED_IDS }
];

const GROUP_META = {
  "Wind Ensemble": { type: "Ensemble", owner: "AshleyBands staff", classIds: ["advanced"] },
  "Concert Band": { type: "Ensemble", owner: "AshleyBands staff", classIds: ["intermediate", "accommodated"] },
  "Marching Band": { type: "Activity", owner: "AshleyBands staff", classIds: [] },
  "Jazz Ensemble": { type: "Activity", owner: "AshleyBands staff", classIds: [] },
  "Color Guard": { type: "Team", owner: "AshleyBands staff", classIds: [] },
  "Carnegie Hall 2027": { type: "Trip", owner: "Trip roster", classIds: [] }
};

const GROUPS = Object.entries(GROUP_META).map(([name, meta]) => ({
  id: slug(name),
  name,
  ...meta,
  studentIds: name === "Carnegie Hall 2027" ? [...TRIP_IDS] : ACTIVE.filter((student) => student.ensembles.includes(name)).map((student) => student.id)
}));

const ATTENTION = [
  { id: "rowan-placement", studentId: "rowan-fields", title: "Class connection needs review", detail: "Wind Ensemble · Band Accommodated Honors Fall" },
  { id: "nia-placement", studentId: "nia-grove", title: "Program placement not confirmed", detail: "Infinite Campus class is matched; staff placement needs review" }
];

const VIEWS = [["groups", "Groups"], ["students", "Build a roster"], ["classes", "Class sections"], ["attention", "Needs attention"]];
const SORTS = [["name", "Student name"], ["last", "Last name"], ["grade", "Grade"], ["memberships", "Most memberships"]];

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function schoolClassFor(studentId) {
  return SCHOOL_CLASSES.find((item) => item.studentIds.includes(studentId)) || null;
}

function membershipsFor(student) {
  return GROUPS.filter((group) => group.studentIds.includes(student.id));
}

function familyName(student) {
  return (student.legalName || student.displayName).trim().split(/\s+/).at(-1);
}

function compareStudents(left, right, sort) {
  if (sort === "last") return familyName(left).localeCompare(familyName(right)) || left.displayName.localeCompare(right.displayName);
  if (sort === "grade") return Number(left.grade) - Number(right.grade) || left.displayName.localeCompare(right.displayName);
  if (sort === "memberships") return membershipsFor(right).length - membershipsFor(left).length || left.displayName.localeCompare(right.displayName);
  return left.displayName.localeCompare(right.displayName);
}

export default function EnsemblesMembershipsPrototype({ initialView = "groups", initialStudentId = "", initialDetailId = "" }) {
  const [view, setView] = useState(VIEWS.some(([value]) => value === initialView) ? initialView : "groups");
  const [studentId, setStudentId] = useState(BY_ID.has(initialStudentId) ? initialStudentId : "");
  const [detailId, setDetailId] = useState(initialDetailId);
  const [search, setSearch] = useState("");
  const [ensemble, setEnsemble] = useState(ALL);
  const [activity, setActivity] = useState(ALL);
  const [classId, setClassId] = useState(ALL);
  const [grade, setGrade] = useState(ALL);
  const [instrument, setInstrument] = useState(ALL);
  const [sort, setSort] = useState("name");
  const [notice, setNotice] = useState("");

  const student = BY_ID.get(studentId) || null;
  const detailGroup = GROUPS.find((group) => `group-${group.id}` === detailId) || null;
  const detailClass = SCHOOL_CLASSES.find((item) => `class-${item.id}` === detailId) || null;
  const hasDetail = Boolean(detailGroup || detailClass);

  const options = useMemo(() => ({
    ensembles: GROUPS.filter((group) => group.type === "Ensemble").map((group) => group.name),
    activities: GROUPS.filter((group) => group.type !== "Ensemble").map((group) => group.name),
    grades: [...new Set(ACTIVE.map((item) => item.grade))].sort((a, b) => Number(a) - Number(b)),
    instruments: [...new Set(ACTIVE.map((item) => item.programInstrument))].sort()
  }), []);

  const roster = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ACTIVE.filter((item) => {
      const memberships = membershipsFor(item).map((group) => group.name);
      const klass = schoolClassFor(item.id);
      const haystack = [item.displayName, item.legalName, item.programInstrument, item.grade, ...memberships, klass?.name, klass?.section].filter(Boolean).join(" ").toLowerCase();
      return (!term || haystack.includes(term))
        && (ensemble === ALL || memberships.includes(ensemble))
        && (activity === ALL || memberships.includes(activity))
        && (classId === ALL || klass?.id === classId)
        && (grade === ALL || item.grade === grade)
        && (instrument === ALL || item.programInstrument === instrument);
    }).sort((left, right) => compareStudents(left, right, sort));
  }, [activity, classId, ensemble, grade, instrument, search, sort]);

  function writeLocation(next = {}) {
    const values = { view, student: studentId, detail: detailId, ...next };
    const params = new URLSearchParams();
    if (values.view !== "groups") params.set("view", values.view);
    if (values.student) params.set("student", values.student);
    if (values.detail) params.set("detail", values.detail);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }

  function chooseView(nextView) {
    setView(nextView); setDetailId(""); setNotice("");
    writeLocation({ view: nextView, detail: "" });
  }

  function chooseDetail(nextDetailId) {
    setDetailId(nextDetailId); setNotice("");
    writeLocation({ detail: nextDetailId });
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId); setDetailId(""); setView("students"); setNotice("");
    writeLocation({ view: "students", student: nextStudentId, detail: "" });
  }

  function clearStudent() {
    setStudentId(""); setNotice("");
    writeLocation({ student: "" });
  }

  function resetRoster() {
    setSearch(""); setEnsemble(ALL); setActivity(ALL); setClassId(ALL); setGrade(ALL); setInstrument(ALL); setSort("name"); setNotice("");
  }

  function runCombinedRoster() {
    setView("students"); setStudentId(""); setDetailId(""); setSearch("");
    setEnsemble("Wind Ensemble"); setActivity("Carnegie Hall 2027"); setClassId(ALL); setGrade(ALL); setInstrument("Percussion"); setSort("name"); setNotice("");
    writeLocation({ view: "students", student: "", detail: "" });
  }

  async function copyEmails(includeGuardians = false, pool = roster) {
    const values = pool.flatMap((item) => includeGuardians ? [item.schoolEmail, item.guardian.email] : [item.schoolEmail]).filter(Boolean);
    await navigator.clipboard.writeText([...new Set(values)].join(", "));
    setNotice(`Copied ${new Set(values).size} email${new Set(values).size === 1 ? "" : "s"}`);
  }

  return <main className={styles.page}>
    <header className={styles.appBar}><div><strong>Ashley Bands</strong><span>Staff workspace</span></div><nav><Link href="/admin/operations-prototype">Command center</Link><Link href="/admin/current-students-prototype">Current students</Link><span className={styles.prototypeBadge}>Prototype · Synthetic data</span></nav></header>

    <section className={styles.heading}><div><p className={styles.eyebrow}>Current operations</p><h1>Ensembles & memberships</h1><p>Current groups, school classes, and the students between them.</p></div><button className={styles.quickRoster} onClick={runCombinedRoster}><span>Quick roster</span><strong>Wind + percussion + trip →</strong></button></section>

    <section className={styles.sourceRules} aria-label="Membership sources">
      <div><span>AshleyBands</span><strong>Program memberships</strong><small>Staff managed</small></div>
      <div><span>Infinite Campus</span><strong>School class enrollment</strong><small>Official source</small></div>
      <div><span>Student profile</span><strong>Grade and instrument</strong><small>Connected facts</small></div>
    </section>

    {student ? <section className={styles.scopeBar}><div><span>Student context</span><strong>{student.displayName}</strong><p>Showing this student&apos;s current memberships.</p></div><div><Link href={`/admin/current-students-prototype?student=${encodeURIComponent(student.id)}`}>Open full student</Link><button onClick={clearStudent}>Show full program</button></div></section> : null}

    <section className={styles.signalBar}><div><span>Program groups</span><strong>{GROUPS.length}</strong></div><div><span>School sections</span><strong>{SCHOOL_CLASSES.length}</strong></div><div><span>Current students</span><strong>{ACTIVE.length}</strong></div><div><span>Need review</span><strong className={styles.warnText}>{ATTENTION.length}</strong></div><p>Current memberships only</p></section>

    <div className={[styles.workspace, hasDetail ? styles.withDetail : ""].filter(Boolean).join(" ")}>
      <aside className={styles.filters}><strong>{student ? "This student" : "Questions"}</strong><div className={styles.viewButtons}>{VIEWS.map(([value, label]) => <button key={value} className={view === value ? styles.activeView : ""} onClick={() => chooseView(value)}>{label}</button>)}</div>{!student && view !== "students" ? <label><span>Search this view</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Group or class..." /></label> : null}<button className={styles.combinedButton} onClick={runCombinedRoster}>Wind + percussion + trip</button><p>Class enrollment and program membership remain separate records.</p></aside>

      <section className={styles.resultsPanel}>
        {student ? <StudentMemberships student={student} onDetail={chooseDetail} /> : view === "groups" ? <GroupResults search={search} onDetail={chooseDetail} /> : view === "classes" ? <ClassResults search={search} onDetail={chooseDetail} /> : view === "attention" ? <AttentionResults onStudent={scopeStudent} /> : <RosterResults roster={roster} filters={{ search, ensemble, activity, classId, grade, instrument, sort }} setters={{ setSearch, setEnsemble, setActivity, setClassId, setGrade, setInstrument, setSort }} options={options} onReset={resetRoster} onStudent={scopeStudent} onCopy={copyEmails} notice={notice} />}
      </section>

      {detailGroup ? <GroupDetail group={detailGroup} onClose={() => chooseDetail("")} onStudent={scopeStudent} onCopy={copyEmails} /> : null}
      {detailClass ? <ClassDetail klass={detailClass} onClose={() => chooseDetail("")} onStudent={scopeStudent} /> : null}
    </div>
  </main>;
}

function GroupResults({ search, onDetail }) {
  const term = search.trim().toLowerCase();
  const rows = GROUPS.filter((group) => !term || [group.name, group.type, group.owner].join(" ").toLowerCase().includes(term));
  return <><PanelHeader title="Current program groups" count={rows.length}><Search value={search} /></PanelHeader><Table><thead><tr><th>Group</th><th>Type</th><th>Members</th><th>Membership owner</th><th>School connection</th><th></th></tr></thead><tbody>{rows.map((group) => <tr key={group.id}><td><strong>{group.name}</strong></td><td><Status tone="plain">{group.type}</Status></td><td>{group.studentIds.length}</td><td>{group.owner}</td><td>{group.classIds.length ? group.classIds.map((id) => schoolClassForGroup(id).name).join(" + ") : "None required"}</td><td><button className={styles.rowAction} onClick={() => onDetail(`group-${group.id}`)}>Open group</button></td></tr>)}</tbody></Table></>;
}

function schoolClassForGroup(classId) {
  return SCHOOL_CLASSES.find((item) => item.id === classId);
}

function ClassResults({ search, onDetail }) {
  const term = search.trim().toLowerCase();
  const rows = SCHOOL_CLASSES.filter((klass) => !term || [klass.name, klass.section, klass.expectedGroup].join(" ").toLowerCase().includes(term));
  return <><PanelHeader title="Infinite Campus class sections" count={rows.length}><Search value={search} /></PanelHeader><Table><thead><tr><th>Class</th><th>Section</th><th>Students</th><th>Program connection</th><th>Source</th><th></th></tr></thead><tbody>{rows.map((klass) => <tr key={klass.id}><td><strong>{klass.name}</strong></td><td>{klass.section}</td><td>{klass.studentIds.length}</td><td>{klass.expectedGroup}</td><td><Status tone="source">Infinite Campus</Status></td><td><button className={styles.rowAction} onClick={() => onDetail(`class-${klass.id}`)}>Open class</button></td></tr>)}</tbody></Table></>;
}

function AttentionResults({ onStudent }) {
  return <><PanelHeader title="Memberships needing review" count={ATTENTION.length} /><Table><thead><tr><th>Student</th><th>Question</th><th>Current connection</th><th></th></tr></thead><tbody>{ATTENTION.map((item) => { const student = BY_ID.get(item.studentId); return <tr key={item.id}><td><strong>{student.displayName}</strong></td><td>{item.title}</td><td>{item.detail}</td><td><button className={styles.rowAction} onClick={() => onStudent(student.id)}>Open student</button></td></tr>; })}</tbody></Table></>;
}

function RosterResults({ roster, filters, setters, options, onReset, onStudent, onCopy, notice }) {
  return <><PanelHeader title="Current roster results" count={roster.length}><div className={styles.rosterActions}><button onClick={() => onCopy(false)}>Copy students</button><button onClick={() => onCopy(true)}>Copy students + guardians</button></div></PanelHeader><section className={styles.filterGrid}><label><span>Search</span><input value={filters.search} onChange={(event) => setters.setSearch(event.target.value)} placeholder="Student, group, class..." /></label><Select label="Ensemble" value={filters.ensemble} onChange={setters.setEnsemble} options={options.ensembles} /><Select label="Activity or trip" value={filters.activity} onChange={setters.setActivity} options={options.activities} /><Select label="School class" value={filters.classId} onChange={setters.setClassId} options={SCHOOL_CLASSES.map((item) => [item.id, item.name])} pairs /><Select label="Grade" value={filters.grade} onChange={setters.setGrade} options={options.grades} /><Select label="Instrument" value={filters.instrument} onChange={setters.setInstrument} options={options.instruments} /><Select label="Sort" value={filters.sort} onChange={setters.setSort} options={SORTS} pairs all={false} /><button className={styles.resetButton} onClick={onReset}>Reset</button></section>{notice ? <p className={styles.notice}>{notice}</p> : null}<Table><thead><tr><th>Student</th><th>Grade</th><th>Program memberships</th><th>School class</th><th>Instrument</th><th></th></tr></thead><tbody>{roster.map((student) => <tr key={student.id}><td><strong>{student.displayName}</strong></td><td>{student.grade}</td><td><div className={styles.tagStack}>{membershipsFor(student).map((group) => <span key={group.id}>{group.name}</span>)}</div></td><td>{schoolClassFor(student.id)?.name || "Unmatched"}</td><td>{student.programInstrument}</td><td><button className={styles.rowAction} onClick={() => onStudent(student.id)}>Open memberships</button></td></tr>)}</tbody></Table></>;
}

function StudentMemberships({ student, onDetail }) {
  const memberships = membershipsFor(student);
  const klass = schoolClassFor(student.id);
  return <><section className={styles.studentSummary}><div><span>Program memberships</span><strong>{memberships.length}</strong></div><div><span>School class</span><strong>{klass?.name || "Unmatched"}</strong></div><div><span>Instrument</span><strong>{student.programInstrument}</strong></div></section><PanelHeader title="Current memberships" count={memberships.length} /><Table><thead><tr><th>Group</th><th>Type</th><th>Membership owner</th><th>School connection</th><th></th></tr></thead><tbody>{memberships.map((group) => <tr key={group.id}><td><strong>{group.name}</strong></td><td>{group.type}</td><td>{group.owner}</td><td>{group.classIds.length ? group.classIds.map((id) => schoolClassForGroup(id).name).join(" + ") : "None required"}</td><td><button className={styles.rowAction} onClick={() => onDetail(`group-${group.id}`)}>Open group</button></td></tr>)}</tbody></Table><section className={styles.connectedLinks}><Link href={`/admin/attendance-workspace-prototype?student=${encodeURIComponent(student.id)}`}>Attendance →</Link><Link href={`/admin/assets-inventory-prototype?student=${encodeURIComponent(student.id)}`}>Assets →</Link><Link href={`/admin/current-students-prototype?student=${encodeURIComponent(student.id)}`}>Full student →</Link></section></>;
}

function GroupDetail({ group, onClose, onStudent, onCopy }) {
  const members = group.studentIds.map((id) => BY_ID.get(id)).filter(Boolean);
  return <aside className={styles.detail} aria-label={`${group.name} membership details`}><DetailHeader eyebrow="Program group" title={group.name} subtitle={group.type} onClose={onClose} /><section className={styles.detailSection}><h3>Current record</h3><dl><div><dt>Members</dt><dd>{members.length}</dd></div><div><dt>Owner</dt><dd>{group.owner}</dd></div><div><dt>Class connection</dt><dd>{group.classIds.length ? group.classIds.map((id) => schoolClassForGroup(id).name).join(" + ") : "None required"}</dd></div></dl><div className={styles.detailActions}><button onClick={() => onCopy(false, members)}>Copy student emails</button><button onClick={() => onCopy(true, members)}>Copy students + guardians</button></div></section><section className={styles.detailSection}><h3>Current members</h3><div className={styles.memberRows}>{members.map((student) => <button key={student.id} onClick={() => onStudent(student.id)}><span><strong>{student.displayName}</strong><small>Grade {student.grade} · {student.programInstrument}</small></span><b>→</b></button>)}</div></section></aside>;
}

function ClassDetail({ klass, onClose, onStudent }) {
  return <aside className={styles.detail} aria-label={`${klass.name} enrollment details`}><DetailHeader eyebrow="Infinite Campus class" title={klass.name} subtitle={klass.section} onClose={onClose} /><section className={styles.detailSection}><h3>Source boundary</h3><dl><div><dt>Official source</dt><dd>Infinite Campus</dd></div><div><dt>Students</dt><dd>{klass.studentIds.length}</dd></div><div><dt>Program connection</dt><dd>{klass.expectedGroup}</dd></div></dl><p>Class enrollment does not automatically change AshleyBands program membership.</p></section><section className={styles.detailSection}><h3>Students in section</h3><div className={styles.memberRows}>{klass.studentIds.map((id) => { const student = BY_ID.get(id); return <button key={id} onClick={() => onStudent(id)}><span><strong>{student.displayName}</strong><small>{membershipsFor(student).map((group) => group.name).join(" · ")}</small></span><b>→</b></button>; })}</div></section></aside>;
}

function PanelHeader({ title, count, children }) {
  return <header className={styles.panelHeader}><div><strong>{title}</strong><span>{count} result{count === 1 ? "" : "s"}</span></div>{children || <span>Read-only prototype</span>}</header>;
}

function Table({ children }) {
  return <div className={styles.tableWrap}><table>{children}</table></div>;
}

function Search({ value }) {
  return <span className={styles.passiveSearch}>{value ? `Search: ${value}` : "Read-only prototype"}</span>;
}

function Select({ label, value, onChange, options, pairs = false, all = true }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{all ? <option value={ALL}>All</option> : null}{options.map((option) => { const [optionValue, optionLabel] = pairs ? option : [option, option]; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></label>;
}

function DetailHeader({ eyebrow, title, subtitle, onClose }) {
  return <header><div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Close membership details">×</button></header>;
}

function Status({ tone, children }) {
  return <span className={[styles.status, styles[tone]].join(" ")}>{children}</span>;
}
