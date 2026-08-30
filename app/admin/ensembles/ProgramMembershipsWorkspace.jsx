"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import { compareMembershipStudents, matchesMembershipStudent, sourceLabel } from "./program-memberships.logic.mjs";
import styles from "../ensembles-memberships-prototype/ensembles-memberships-prototype.module.css";

const ALL = "";
const VIEWS = [["groups", "Groups"], ["students", "Build a roster"], ["classes", "Class sections"], ["attention", "Needs attention"]];
const SORTS = [["name", "Student name"], ["last", "Last name"], ["grade", "Grade"], ["memberships", "Most memberships"]];

function dateLabel(value) {
  if (!value) return "not synced yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function titleCase(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function updateLocation(values) {
  const params = new URLSearchParams();
  if (values.view && values.view !== "groups") params.set("view", values.view);
  if (values.student) params.set("student", values.student);
  if (values.detail) params.set("detail", values.detail);
  if (values.search) params.set("q", values.search);
  if (values.ensembleId) params.set("ensemble", values.ensembleId);
  if (values.activityId) params.set("activity", values.activityId);
  if (values.sectionId) params.set("class", values.sectionId);
  if (values.grade) params.set("grade", values.grade);
  if (values.instrument) params.set("instrument", values.instrument);
  if (values.sort && values.sort !== "name") params.set("sort", values.sort);
  const query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
}

export default function ProgramMembershipsWorkspace(props) {
  return <StaffGate>{(session, signOut) => <AuthenticatedWorkspace {...props} session={session} signOut={signOut} />}</StaffGate>;
}

function AuthenticatedWorkspace({ session, signOut, initialView, initialStudentId, initialDetail, initialSearch, initialEnsembleId, initialActivityId, initialSectionId, initialGrade, initialInstrument, initialSort }) {
  const [data, setData] = useState({ students: [], groups: [], sections: [], attention: [], counts: { students: 0, groups: 0, sections: 0, attention: 0 }, updatedAt: null });
  const [loadState, setLoadState] = useState({ loading: true, error: "" });
  const [view, setView] = useState(VIEWS.some(([key]) => key === initialView) ? initialView : "groups");
  const [studentId, setStudentId] = useState(initialStudentId || "");
  const [detail, setDetail] = useState(initialDetail || "");
  const [search, setSearch] = useState(initialSearch || "");
  const [ensembleId, setEnsembleId] = useState(initialEnsembleId || ALL);
  const [activityId, setActivityId] = useState(initialActivityId || ALL);
  const [sectionId, setSectionId] = useState(initialSectionId || ALL);
  const [grade, setGrade] = useState(initialGrade || ALL);
  const [instrument, setInstrument] = useState(initialInstrument || ALL);
  const [sort, setSort] = useState(SORTS.some(([key]) => key === initialSort) ? initialSort : "name");
  const [notice, setNotice] = useState("");
  const detailRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/program-memberships", { headers: staffAuthHeaders(session), signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Program memberships could not be loaded.");
        return body;
      })
      .then((body) => {
        setData(body);
        setLoadState({ loading: false, error: "" });
        if (initialStudentId && !(body.students || []).some((student) => student.id === initialStudentId)) setStudentId("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setLoadState({ loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [initialStudentId, session]);

  useEffect(() => {
    updateLocation({ view, student: studentId, detail, search, ensembleId, activityId, sectionId, grade, instrument, sort });
  }, [activityId, detail, ensembleId, grade, instrument, search, sectionId, sort, studentId, view]);

  useEffect(() => {
    if (!detail || !window.matchMedia("(max-width: 780px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      detailRef.current?.focus({ preventScroll: true });
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detail]);

  const studentsById = useMemo(() => new Map(data.students.map((student) => [student.id, student])), [data.students]);
  const groupsById = useMemo(() => new Map(data.groups.map((group) => [group.id, group])), [data.groups]);
  const sectionsById = useMemo(() => new Map(data.sections.map((section) => [section.id, section])), [data.sections]);
  const student = studentsById.get(studentId) || null;
  const detailGroup = detail.startsWith("group:") ? groupsById.get(detail.slice(6)) : null;
  const detailSection = detail.startsWith("class:") ? sectionsById.get(detail.slice(6)) : null;

  const options = useMemo(() => ({
    grades: unique(data.students.map((item) => item.grade)),
    instruments: unique(data.students.map((item) => item.instrument)),
  }), [data.students]);

  const roster = useMemo(() => data.students.filter((item) => matchesMembershipStudent(item, {
    search,
    groupIds: [ensembleId, activityId].filter(Boolean),
    sectionId,
    grade,
    instrument,
    groupNames: item.groupIds.map((id) => groupsById.get(id)?.name).filter(Boolean),
    sectionNames: item.sectionIds.map((id) => sectionsById.get(id)?.name).filter(Boolean),
  })).sort((left, right) => compareMembershipStudents(left, right, sort, (item) => item.groupIds.length)), [activityId, data.students, ensembleId, grade, groupsById, instrument, search, sectionId, sectionsById, sort]);

  function chooseView(nextView) {
    if (studentId && nextView !== "students") setStudentId("");
    setView(nextView); setDetail(""); setNotice("");
  }

  function chooseDetail(nextDetail) {
    setDetail(nextDetail); setNotice("");
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId); setView("students"); setDetail(""); setNotice("");
  }

  function clearStudent() {
    setStudentId(""); setNotice("");
  }

  function resetRoster() {
    setSearch(""); setEnsembleId(ALL); setActivityId(ALL); setSectionId(ALL); setGrade(ALL); setInstrument(ALL); setSort("name"); setNotice("");
  }

  function quickRoster() {
    const wind = data.groups.find((group) => group.name === "Wind Ensemble");
    setView("students"); setStudentId(""); setDetail(""); setSearch(""); setEnsembleId(wind?.id || ALL); setActivityId(ALL);
    setSectionId(ALL); setGrade(ALL); setInstrument("Percussion"); setSort("name"); setNotice("");
  }

  async function copyContacts(studentIds, audience) {
    if (!studentIds.length) { setNotice("No current students are in this list."); return; }
    setNotice("Preparing the contact list…");
    const response = await fetch("/api/admin/program-memberships/contacts", {
      method: "POST",
      headers: staffAuthHeaders(session),
      body: JSON.stringify({ studentIds, audience }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(body.error || "The contact list could not be prepared."); return; }
    if (!body.emails?.length) { setNotice("No matching email addresses are available."); return; }
    await navigator.clipboard?.writeText(body.emails.join(", "));
    const label = audience === "students" ? "student" : audience === "guardians" ? "guardian" : "student + guardian";
    setNotice(`${body.emails.length} ${label} emails copied.`);
  }

  const latestClassSync = data.sections.map((section) => section.lastSyncedAt).filter(Boolean).sort().at(-1);
  const visibleAttention = student ? data.attention.filter((item) => item.studentId === student.id) : data.attention;
  const hasDetail = Boolean(detailGroup || detailSection);

  return <main className={styles.page}>
    <header className={styles.appBar}>
      <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
      <nav><Link href="/admin">Command center</Link><Link href="/admin/students">Current students</Link><button type="button" onClick={signOut} className={styles.prototypeBadge}>Sign out</button></nav>
    </header>

    <section className={styles.heading}>
      <div><p className={styles.eyebrow}>Current operations</p><h1>Ensembles & memberships</h1><p>Program groups, school-class status, and the students connecting them.</p></div>
      <button className={styles.quickRoster} onClick={quickRoster}><span>Quick roster</span><strong>Wind + percussion →</strong></button>
    </section>

    <section className={styles.sourceRules} aria-label="Membership sources">
      <div><span>AshleyBands</span><strong>Program memberships</strong><small>Current roster projection</small></div>
      <div><span>School classes</span><strong>Separate enrollment record</strong><small>{latestClassSync ? `Imported · synced ${dateLabel(latestClassSync)}` : "No section import connected"}</small></div>
      <div><span>Roster-owned facts</span><strong>Grade and program instrument</strong><small>Current roster projection</small></div>
    </section>

    {student ? <section className={styles.scopeBar}><div><span>Student context</span><strong>{student.displayName}</strong><p>Showing this student&apos;s current connections.</p></div><div><Link href={`/admin/students?student=${encodeURIComponent(student.id)}`}>Open full student</Link><button onClick={clearStudent}>Show full program</button></div></section> : null}

    <section className={styles.signalBar} aria-label="Membership signals">
      <div><span>Program groups</span><strong>{data.counts.groups}</strong></div><div><span>Class sections</span><strong>{data.counts.sections}</strong></div><div><span>Current students</span><strong>{data.counts.students}</strong></div><div><span>Need review</span><strong className={data.counts.attention ? styles.warnText : ""}>{data.counts.attention}</strong></div><p>{data.updatedAt ? `Current record update · ${dateLabel(data.updatedAt)}` : "Current records"}</p>
    </section>

    {loadState.error ? <p className={styles.notice} role="alert">{loadState.error}</p> : null}

    <div className={[styles.workspace, hasDetail ? styles.withDetail : ""].filter(Boolean).join(" ")}>
      <aside className={styles.filters}>
        <strong>{student ? "This student" : "Questions"}</strong>
        <div className={styles.viewButtons}>{VIEWS.map(([key, label]) => <button key={key} className={view === key ? styles.activeView : ""} onClick={() => chooseView(key)}>{label}</button>)}</div>
        {!student && view !== "students" ? <label><span>Search this view</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Group, class, student…" /></label> : null}
        <button className={styles.combinedButton} onClick={quickRoster}>Wind + percussion</button>
        <p>Class enrollment and program membership remain separate records.</p>
      </aside>

      <section className={styles.resultsPanel}>
        {loadState.loading ? <PanelHeader title="Loading current memberships…" count={0} />
          : student ? <StudentConnections student={student} groupsById={groupsById} sectionsById={sectionsById} attention={visibleAttention} onDetail={chooseDetail} />
            : view === "groups" ? <GroupResults groups={data.groups} sectionsById={sectionsById} search={search} onDetail={chooseDetail} />
              : view === "classes" ? <ClassResults sections={data.sections} groupsById={groupsById} search={search} onDetail={chooseDetail} />
                : view === "attention" ? <AttentionResults attention={data.attention} studentsById={studentsById} search={search} onStudent={scopeStudent} />
                  : <RosterResults roster={roster} data={data} filters={{ search, ensembleId, activityId, sectionId, grade, instrument, sort }} setters={{ setSearch, setEnsembleId, setActivityId, setSectionId, setGrade, setInstrument, setSort }} options={options} groupsById={groupsById} sectionsById={sectionsById} onReset={resetRoster} onStudent={scopeStudent} onCopy={copyContacts} notice={notice} />}
      </section>

      {detailGroup ? <GroupDetail detailRef={detailRef} group={detailGroup} studentsById={studentsById} sectionsById={sectionsById} onClose={() => chooseDetail("")} onStudent={scopeStudent} onCopy={copyContacts} /> : null}
      {detailSection ? <ClassDetail detailRef={detailRef} section={detailSection} studentsById={studentsById} groupsById={groupsById} onClose={() => chooseDetail("")} onStudent={scopeStudent} /> : null}
    </div>
  </main>;
}

function GroupResults({ groups, sectionsById, search, onDetail }) {
  const term = search.trim().toLowerCase();
  const rows = groups.filter((group) => !term || [group.name, group.type, group.owner].join(" ").toLowerCase().includes(term));
  return <><PanelHeader title="Current program groups" count={rows.length} /><Table><thead><tr><th>Group</th><th>Type</th><th>Members</th><th>Owner</th><th>School connection</th><th></th></tr></thead><tbody>{rows.map((group) => <tr key={group.id}><td data-label="Group"><strong>{group.name}</strong></td><td data-label="Type"><Status tone="plain">{titleCase(group.type)}</Status></td><td data-label="Members">{group.memberIds.length}</td><td data-label="Owner">{group.owner}</td><td data-label="School connection">{group.expectedSectionIds.map((id) => sectionsById.get(id)?.name).filter(Boolean).join(" + ") || "None required"}</td><td data-label="Open"><button className={styles.rowAction} onClick={() => onDetail(`group:${group.id}`)}>Open group</button></td></tr>)}</tbody></Table></>;
}

function ClassResults({ sections, groupsById, search, onDetail }) {
  const term = search.trim().toLowerCase();
  const rows = sections.filter((section) => !term || [section.name, section.sectionCode, section.term].join(" ").toLowerCase().includes(term));
  return <><PanelHeader title="Current class sections" count={rows.length} />{!rows.length ? <p className={styles.notice}>No class-section source is connected yet. The roster still shows each student&apos;s general band-class status.</p> : null}<Table><thead><tr><th>Class</th><th>Section</th><th>Students</th><th>Program connection</th><th>Source</th><th></th></tr></thead><tbody>{rows.map((section) => <tr key={section.id}><td data-label="Class"><strong>{section.name}</strong></td><td data-label="Section">{section.sectionCode || "Not imported"}</td><td data-label="Students">{section.studentIds.length}</td><td data-label="Program connection">{section.expectedGroupIds.map((id) => groupsById.get(id)?.name).filter(Boolean).join(" + ") || "No expectation"}</td><td data-label="Source"><Status tone="source">{sourceLabel(section.source)}</Status></td><td data-label="Open"><button className={styles.rowAction} onClick={() => onDetail(`class:${section.id}`)}>Open class</button></td></tr>)}</tbody></Table></>;
}

function AttentionResults({ attention, studentsById, search, onStudent }) {
  const term = search.trim().toLowerCase();
  const rows = attention.filter((item) => { const student = studentsById.get(item.studentId); return student && (!term || [student.displayName, item.type, item.detail].join(" ").toLowerCase().includes(term)); });
  return <><PanelHeader title="Connections needing review" count={rows.length} /><Table><thead><tr><th>Student</th><th>Question</th><th>Current connection</th><th></th></tr></thead><tbody>{rows.map((item, index) => { const student = studentsById.get(item.studentId); return <tr key={`${item.studentId}-${item.type}-${index}`}><td data-label="Student"><strong>{student.displayName}</strong></td><td data-label="Question">{item.type}</td><td data-label="Current connection">{item.detail}</td><td data-label="Open"><button className={styles.rowAction} onClick={() => onStudent(student.id)}>Open student</button></td></tr>; })}</tbody></Table></>;
}

function RosterResults({ roster, data, filters, setters, options, groupsById, sectionsById, onReset, onStudent, onCopy, notice }) {
  return <><PanelHeader title="Current roster results" count={roster.length}><div className={styles.rosterActions}><button onClick={() => onCopy(roster.map((item) => item.id), "students")}>Copy students</button><button onClick={() => onCopy(roster.map((item) => item.id), "both")}>Copy students + guardians</button></div></PanelHeader>
    <section className={styles.filterGrid}><label><span>Search</span><input value={filters.search} onChange={(event) => setters.setSearch(event.target.value)} placeholder="Student, group, class…" /></label><Select label="Ensemble" value={filters.ensembleId} onChange={setters.setEnsembleId} options={data.groups.filter((group) => group.type === "ensemble").map((group) => [group.id, group.name])} /><Select label="Activity, team, or trip" value={filters.activityId} onChange={setters.setActivityId} options={data.groups.filter((group) => group.type !== "ensemble").map((group) => [group.id, group.name])} /><Select label="School class" value={filters.sectionId} onChange={setters.setSectionId} options={data.sections.map((section) => [section.id, section.name])} /><Select label="Grade" value={filters.grade} onChange={setters.setGrade} options={options.grades.map((value) => [value, value])} /><Select label="Instrument" value={filters.instrument} onChange={setters.setInstrument} options={options.instruments.map((value) => [value, value])} /><Select label="Sort" value={filters.sort} onChange={setters.setSort} options={SORTS} includeAll={false} /><button className={styles.resetButton} onClick={onReset}>Reset</button></section>
    {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}
    <Table><thead><tr><th>Student</th><th>Grade</th><th>Program memberships</th><th>School class</th><th>Instrument</th><th></th></tr></thead><tbody>{roster.map((student) => <tr key={student.id}><td data-label="Student"><strong>{student.displayName}</strong></td><td data-label="Grade">{student.grade}</td><td data-label="Program memberships"><div className={styles.tagStack}>{student.groupIds.length ? student.groupIds.map((id) => <span key={id}>{groupsById.get(id)?.name}</span>) : <span>Unassigned</span>}</div></td><td data-label="School class">{student.sectionIds.map((id) => sectionsById.get(id)?.name).filter(Boolean).join(" + ") || `Band class: ${student.bandClassStatus} · section not imported`}</td><td data-label="Instrument">{student.instrument}</td><td data-label="Open"><button className={styles.rowAction} onClick={() => onStudent(student.id)}>Open connections</button></td></tr>)}</tbody></Table></>;
}

function StudentConnections({ student, groupsById, sectionsById, attention, onDetail }) {
  const groups = student.groupIds.map((id) => groupsById.get(id)).filter(Boolean);
  const sections = student.sectionIds.map((id) => sectionsById.get(id)).filter(Boolean);
  return <><section className={styles.studentSummary}><div><span>Program memberships</span><strong>{groups.length}</strong></div><div><span>School class</span><strong>{sections.map((item) => item.name).join(" + ") || `Band class: ${student.bandClassStatus} · section not imported`}</strong></div><div><span>Instrument</span><strong>{student.instrument}</strong></div></section><PanelHeader title="Current memberships" count={groups.length} /><Table><thead><tr><th>Group</th><th>Type</th><th>Owner</th><th>School connection</th><th></th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td data-label="Group"><strong>{group.name}</strong></td><td data-label="Type">{titleCase(group.type)}</td><td data-label="Owner">{group.owner}</td><td data-label="School connection">{group.expectedSectionIds.map((id) => sectionsById.get(id)?.name).filter(Boolean).join(" + ") || "None required"}</td><td data-label="Open"><button className={styles.rowAction} onClick={() => onDetail(`group:${group.id}`)}>Open group</button></td></tr>)}</tbody></Table>{attention.length ? <p className={styles.notice}>{attention.length} connection{attention.length === 1 ? "" : "s"} need review.</p> : null}<section className={styles.connectedLinks}><Link href={`/admin/students?student=${encodeURIComponent(student.id)}`}>Full student →</Link><Link href={`/admin/attendance?student=${encodeURIComponent(student.id)}`}>Attendance →</Link></section></>;
}

function GroupDetail({ detailRef, group, studentsById, sectionsById, onClose, onStudent, onCopy }) {
  const members = group.memberIds.map((id) => studentsById.get(id)).filter(Boolean);
  return <aside ref={detailRef} tabIndex={-1} className={styles.detail} aria-label={`${group.name} membership details`}><DetailHeader eyebrow="Program group" title={group.name} subtitle={titleCase(group.type)} onClose={onClose} /><section className={styles.detailSection}><h3>Current record</h3><dl><div><dt>Members</dt><dd>{members.length}</dd></div><div><dt>Owner</dt><dd>{group.owner}</dd></div><div><dt>Group definition</dt><dd>{sourceLabel(group.source)}</dd></div><div><dt>Membership records</dt><dd>{group.membershipSources.map(sourceLabel).join(" + ") || "No current members"}</dd></div><div><dt>Class connection</dt><dd>{group.expectedSectionIds.map((id) => sectionsById.get(id)?.name).filter(Boolean).join(" + ") || "None required"}</dd></div></dl><div className={styles.detailActions}><button onClick={() => onCopy(group.memberIds, "students")}>Copy student emails</button><button onClick={() => onCopy(group.memberIds, "both")}>Copy students + guardians</button></div></section><section className={styles.detailSection}><h3>Current members</h3><div className={styles.memberRows}>{members.map((student) => <button key={student.id} onClick={() => onStudent(student.id)}><span><strong>{student.displayName}</strong><small>Grade {student.grade} · {student.instrument}</small></span><b>→</b></button>)}</div></section></aside>;
}

function ClassDetail({ detailRef, section, studentsById, groupsById, onClose, onStudent }) {
  const students = section.studentIds.map((id) => studentsById.get(id)).filter(Boolean);
  return <aside ref={detailRef} tabIndex={-1} className={styles.detail} aria-label={`${section.name} enrollment details`}><DetailHeader eyebrow="School class projection" title={section.name} subtitle={section.sectionCode || section.term} onClose={onClose} /><section className={styles.detailSection}><h3>Source boundary</h3><dl><div><dt>Source</dt><dd>{sourceLabel(section.source)}</dd></div><div><dt>Last synced</dt><dd>{dateLabel(section.lastSyncedAt)}</dd></div><div><dt>Students</dt><dd>{students.length}</dd></div><div><dt>Program connection</dt><dd>{section.expectedGroupIds.map((id) => groupsById.get(id)?.name).filter(Boolean).join(" + ") || "No expectation"}</dd></div></dl><p>Class enrollment does not automatically change AshleyBands program membership.</p></section><section className={styles.detailSection}><h3>Students in section</h3><div className={styles.memberRows}>{students.map((student) => <button key={student.id} onClick={() => onStudent(student.id)}><span><strong>{student.displayName}</strong><small>{student.groupIds.map((id) => groupsById.get(id)?.name).filter(Boolean).join(" · ") || "No program membership"}</small></span><b>→</b></button>)}</div></section></aside>;
}

function PanelHeader({ title, count, children }) {
  return <header className={styles.panelHeader}><div><strong>{title}</strong><span>{count} result{count === 1 ? "" : "s"}</span></div>{children || <span>Current records only</span>}</header>;
}

function Table({ children }) {
  return <div className={styles.tableWrap}><table>{children}</table></div>;
}

function Select({ label, value, onChange, options, includeAll = true }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{includeAll ? <option value="">All</option> : null}{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>;
}

function DetailHeader({ eyebrow, title, subtitle, onClose }) {
  return <header><div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Back to membership results">←</button></header>;
}

function Status({ tone, children }) {
  return <span className={[styles.status, styles[tone]].join(" ")}>{children}</span>;
}
