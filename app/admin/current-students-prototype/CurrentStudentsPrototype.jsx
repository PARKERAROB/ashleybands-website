"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { compareStudents, emailValuesForStudents, needDescription } from "./current-students-prototype.logic.mjs";
import styles from "./current-students-prototype.module.css";

export const STUDENTS = [
  {
    id: "avery-north", status: "active", displayName: "Avery North", legalName: "Avery Jordan North", pronouns: "they/them",
    grade: "10", currentSchool: "Ashley High School", schoolEmail: "avery.north@student.example", personalEmail: "avery.north@example.com", mobile: "(910) 555-0101",
    guardian: { name: "Morgan North", relationship: "Parent", email: "morgan.north@example.com", phone: "(910) 555-0111" },
    ensembles: ["Wind Ensemble", "Marching Band"], programInstrument: "Trumpet", primaryInstrument: "Trumpet", otherInstruments: ["Piano"],
    previousSchool: "Murray Middle", marchingRole: "Trumpet", needs: [], attendance: [12, 13], funding: [275, 500], assets: ["School trumpet", "Locker 114", "Master lock 114", "Tuner 33", "Marching jacket 42"], forms: [5, 5]
  },
  {
    id: "milo-harbor", status: "active", displayName: "Milo Harbor", legalName: "Miles Andrew Harbor", pronouns: "he/him",
    grade: "12", currentSchool: "Ashley High School", schoolEmail: "milo.harbor@student.example", personalEmail: "", mobile: "(910) 555-0102",
    guardian: { name: "Dana Harbor", relationship: "Parent", email: "dana.harbor@example.com", phone: "(910) 555-0112" },
    ensembles: ["Wind Ensemble", "Jazz Ensemble"], programInstrument: "Trombone", primaryInstrument: "Trombone", otherInstruments: ["Bass Guitar"],
    previousSchool: "Myrtle Grove Middle", marchingRole: "Trombone", needs: ["Form"], attendance: [13, 13], funding: [500, 500], assets: ["Locker 087"], forms: [4, 5]
  },
  {
    id: "sage-linden", status: "active", displayName: "Sage Linden", legalName: "Sage Elise Linden", pronouns: "she/her",
    grade: "9", currentSchool: "Ashley High School", schoolEmail: "sage.linden@student.example", personalEmail: "sage.linden@example.com", mobile: "",
    guardian: { name: "Taylor Linden", relationship: "Guardian", email: "taylor.linden@example.com", phone: "(910) 555-0113" },
    ensembles: ["Concert Band", "Color Guard"], programInstrument: "None", primaryInstrument: "None", otherInstruments: ["Piano"],
    previousSchool: "Murray Middle", marchingRole: "Color Guard", needs: ["Transportation"], attendance: [11, 13], funding: [125, 500], assets: ["Guard locker 12", "Guard top 14"], forms: [5, 5]
  },
  {
    id: "rowan-fields", status: "active", displayName: "Rowan Fields", legalName: "Rowan Lee Fields", pronouns: "",
    grade: "11", currentSchool: "Ashley High School", schoolEmail: "rowan.fields@student.example", personalEmail: "rowan.fields@example.com", mobile: "(910) 555-0104",
    guardian: { name: "Casey Fields", relationship: "Parent", email: "casey.fields@example.com", phone: "(910) 555-0114" },
    ensembles: ["Wind Ensemble", "Marching Band"], programInstrument: "Percussion", primaryInstrument: "Percussion", otherInstruments: ["Piano"],
    previousSchool: "Roland-Grise Middle", marchingRole: "Percussion", needs: ["Equipment"], attendance: [12, 13], funding: [340, 500], assets: ["Tuner 08"], forms: [5, 5]
  },
  {
    id: "elena-brook", status: "active", displayName: "Elena Brook", legalName: "Elena Marie Brook", pronouns: "she/her",
    grade: "10", currentSchool: "Ashley High School", schoolEmail: "elena.brook@student.example", personalEmail: "", mobile: "",
    guardian: { name: "Jamie Brook", relationship: "Parent", email: "jamie.brook@example.com", phone: "" },
    ensembles: ["Concert Band"], programInstrument: "Clarinet", primaryInstrument: "Clarinet", otherInstruments: [],
    previousSchool: "Myrtle Grove Middle", marchingRole: "", needs: ["Contact", "Instrument"], attendance: [10, 12], funding: [0, 0], assets: [], forms: [3, 5]
  },
  {
    id: "theo-marin", status: "active", displayName: "Theo Marin", legalName: "Theodore James Marin", pronouns: "he/him",
    grade: "12", currentSchool: "Ashley High School", schoolEmail: "theo.marin@student.example", personalEmail: "theo.marin@example.com", mobile: "(910) 555-0106",
    guardian: { name: "Alex Marin", relationship: "Parent", email: "alex.marin@example.com", phone: "(910) 555-0116" },
    ensembles: ["Wind Ensemble", "Marching Band", "Jazz Ensemble"], programInstrument: "Alto Saxophone", primaryInstrument: "Alto Saxophone", otherInstruments: ["Piano", "Guitar"],
    previousSchool: "Murray Middle", marchingRole: "Alto Saxophone", needs: [], attendance: [13, 13], funding: [510, 500], assets: ["Locker 132", "Tuner 19"], forms: [5, 5]
  },
  {
    id: "imani-stone", status: "active", displayName: "Imani Stone", legalName: "Imani Rae Stone", pronouns: "she/her",
    grade: "11", currentSchool: "Ashley High School", schoolEmail: "imani.stone@student.example", personalEmail: "imani.stone@example.com", mobile: "(910) 555-0107",
    guardian: { name: "Jordan Stone", relationship: "Guardian", email: "jordan.stone@example.com", phone: "(910) 555-0117" },
    ensembles: ["Wind Ensemble", "Marching Band"], programInstrument: "French Horn", primaryInstrument: "French Horn", otherInstruments: [],
    previousSchool: "Noble Middle", marchingRole: "French Horn", needs: [], attendance: [12, 13], funding: [225, 500], assets: ["School horn", "Locker 105"], forms: [5, 5]
  },
  {
    id: "noah-quill", status: "active", displayName: "Noah Quill", legalName: "Noah Evan Quill", pronouns: "",
    grade: "9", currentSchool: "Ashley High School", schoolEmail: "noah.quill@student.example", personalEmail: "", mobile: "(910) 555-0108",
    guardian: { name: "Riley Quill", relationship: "Parent", email: "riley.quill@example.com", phone: "(910) 555-0118" },
    ensembles: ["Concert Band", "Marching Band"], programInstrument: "Tuba", primaryInstrument: "Tuba", otherInstruments: [],
    previousSchool: "Holly Shelter Middle", marchingRole: "Tuba", needs: ["Schedule"], attendance: [9, 12], funding: [80, 500], assets: ["School tuba", "Locker 141"], forms: [4, 5]
  },
  {
    id: "lena-vale", status: "active", displayName: "Lena Vale", legalName: "Magdalena Claire Vale", pronouns: "she/her",
    grade: "10", currentSchool: "Ashley High School", schoolEmail: "lena.vale@student.example", personalEmail: "lena.vale@example.com", mobile: "(910) 555-0109",
    guardian: { name: "Cameron Vale", relationship: "Parent", email: "cameron.vale@example.com", phone: "(910) 555-0119" },
    ensembles: ["Wind Ensemble"], programInstrument: "Flute", primaryInstrument: "Flute", otherInstruments: ["Piano"],
    previousSchool: "Outside New Hanover County", marchingRole: "", needs: [], attendance: [12, 12], funding: [0, 0], assets: ["Locker 044"], forms: [5, 5]
  },
  {
    id: "kai-mercer", status: "active", displayName: "Kai Mercer", legalName: "Kai Thomas Mercer", pronouns: "they/them",
    grade: "11", currentSchool: "Ashley High School", schoolEmail: "kai.mercer@student.example", personalEmail: "kai.mercer@example.com", mobile: "(910) 555-0110",
    guardian: { name: "Robin Mercer", relationship: "Guardian", email: "robin.mercer@example.com", phone: "(910) 555-0120" },
    ensembles: ["Concert Band", "Marching Band"], programInstrument: "Bass Clarinet", primaryInstrument: "Clarinet", otherInstruments: ["Bass Clarinet", "Bass Guitar"],
    previousSchool: "Williston Middle", marchingRole: "Bass Clarinet", needs: [], attendance: [13, 13], funding: [410, 500], assets: ["School bass clarinet", "Locker 063", "Tuner 21"], forms: [5, 5]
  },
  {
    id: "remy-cove", status: "active", displayName: "Remy Cove", legalName: "Remington Cole Cove", pronouns: "he/him",
    grade: "9", currentSchool: "Ashley High School", schoolEmail: "remy.cove@student.example", personalEmail: "", mobile: "(910) 555-0121",
    guardian: { name: "Skyler Cove", relationship: "Parent", email: "skyler.cove@example.com", phone: "(910) 555-0131" },
    ensembles: ["Concert Band"], programInstrument: "Euphonium", primaryInstrument: "Euphonium", otherInstruments: [],
    previousSchool: "Trask Middle", marchingRole: "", needs: ["Instrument"], attendance: [11, 12], funding: [0, 0], assets: [], forms: [5, 5]
  },
  {
    id: "nia-grove", status: "active", displayName: "Nia Grove", legalName: "Nia Simone Grove", pronouns: "she/her",
    grade: "12", currentSchool: "Ashley High School", schoolEmail: "nia.grove@student.example", personalEmail: "nia.grove@example.com", mobile: "(910) 555-0122",
    guardian: { name: "Drew Grove", relationship: "Parent", email: "drew.grove@example.com", phone: "(910) 555-0132" },
    ensembles: ["Wind Ensemble", "Marching Band"], programInstrument: "Oboe", primaryInstrument: "Oboe", otherInstruments: ["Piano"],
    previousSchool: "Murray Middle", marchingRole: "Drum Major", needs: [], attendance: [13, 13], funding: [600, 500], assets: ["Locker 038", "Tuner 04"], forms: [5, 5]
  },
  {
    id: "ellis-frost", status: "inactive", inactiveReason: "Moved", displayName: "Ellis Frost", legalName: "Ellis James Frost", pronouns: "he/him",
    grade: "10", currentSchool: "Other school", schoolEmail: "", personalEmail: "", mobile: "",
    guardian: { name: "Sam Frost", relationship: "Parent", email: "sam.frost@example.com", phone: "(910) 555-0141" },
    ensembles: ["Concert Band"], programInstrument: "Trumpet", primaryInstrument: "Trumpet", otherInstruments: [], previousSchool: "Murray Middle", marchingRole: "",
    needs: [], attendance: [3, 4], funding: [0, 0], assets: [], forms: [4, 5]
  },
  {
    id: "marin-echo", status: "inactive", inactiveReason: "Graduated", displayName: "Marin Echo", legalName: "Marin Jade Echo", pronouns: "she/her",
    grade: "Beyond 12", currentSchool: "", schoolEmail: "", personalEmail: "marin.echo@example.com", mobile: "",
    guardian: { name: "Lee Echo", relationship: "Parent", email: "lee.echo@example.com", phone: "(910) 555-0142" },
    ensembles: ["Wind Ensemble"], programInstrument: "Bassoon", primaryInstrument: "Bassoon", otherInstruments: ["Piano"], previousSchool: "Roland-Grise Middle", marchingRole: "",
    needs: [], attendance: [12, 12], funding: [0, 0], assets: [], forms: [5, 5]
  },
  {
    id: "sol-ember", status: "inactive", inactiveReason: "Dropped", displayName: "Sol Ember", legalName: "Sol Avery Ember", pronouns: "they/them",
    grade: "11", currentSchool: "Ashley High School", schoolEmail: "sol.ember@student.example", personalEmail: "", mobile: "",
    guardian: { name: "Pat Ember", relationship: "Guardian", email: "pat.ember@example.com", phone: "(910) 555-0143" },
    ensembles: ["Marching Band"], programInstrument: "Percussion", primaryInstrument: "Percussion", otherInstruments: [], previousSchool: "Myrtle Grove Middle", marchingRole: "Percussion",
    needs: [], attendance: [5, 8], funding: [100, 500], assets: [], forms: [4, 5]
  }
];

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
  ["needs-desc", "Open needs first"]
];

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function contactReady(student) {
  return Boolean(student.schoolEmail && student.guardian.email && student.guardian.phone);
}

export default function CurrentStudentsPrototype({ initialStudentId = "" }) {
  const initialStudent = STUDENTS.find((student) => student.id === initialStudentId);
  const [view, setView] = useState(initialStudent?.status || "active");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState(ALL);
  const [ensemble, setEnsemble] = useState(ALL);
  const [instrument, setInstrument] = useState(ALL);
  const [need, setNeed] = useState(ALL);
  const [sortBy, setSortBy] = useState("last-asc");
  const [selectedIds, setSelectedIds] = useState([]);
  const [focusedId, setFocusedId] = useState(initialStudent?.id || "avery-north");
  const [notice, setNotice] = useState("");

  const pool = useMemo(() => STUDENTS.filter((student) => student.status === view), [view]);
  const options = useMemo(() => ({
    grades: unique(pool.map((student) => student.grade)),
    ensembles: unique(pool.flatMap((student) => student.ensembles)),
    instruments: unique(pool.map((student) => student.programInstrument)),
    needs: unique(pool.flatMap((student) => student.needs))
  }), [pool]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = pool.filter((student) => {
      const haystack = [student.displayName, student.legalName, student.schoolEmail, student.guardian.name, student.programInstrument, ...student.ensembles].join(" ").toLowerCase();
      return (!term || haystack.includes(term)) &&
        (grade === ALL || student.grade === grade) &&
        (ensemble === ALL || student.ensembles.includes(ensemble)) &&
        (instrument === ALL || student.programInstrument === instrument) &&
        (need === ALL || student.needs.includes(need));
    });
    return [...matches].sort((a, b) => compareStudents(a, b, sortBy));
  }, [pool, search, grade, ensemble, instrument, need, sortBy]);

  const focusedStudent = focusedId
    ? STUDENTS.find((student) => student.id === focusedId && student.status === view) || null
    : null;
  const currentCount = STUDENTS.filter((student) => student.status === "active").length;
  const inactiveCount = STUDENTS.filter((student) => student.status === "inactive").length;
  const followUpCount = pool.filter((student) => student.needs.length).length;
  const contactGapCount = pool.filter((student) => !contactReady(student)).length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((student) => selectedIds.includes(student.id));

  function changeView(nextView) {
    setView(nextView);
    setSelectedIds([]);
    setFocusedId(nextView === "active" ? "avery-north" : "ellis-frost");
    setNotice("");
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
      : [...new Set([...current, ...visibleIds])]
    );
  }

  async function copyEmails(axis) {
    const chosen = STUDENTS.filter((student) => selectedIds.includes(student.id));
    const values = emailValuesForStudents(chosen, axis);
    if (!values.length) { setNotice("No matching emails in the selected rows."); return; }
    await navigator.clipboard?.writeText(values.join(", "));
    const label = axis === "student" ? "student" : axis === "guardian" ? "guardian" : "student + guardian";
    setNotice(`${values.length} synthetic ${label} emails copied.`);
  }

  async function copyStudentAndGuardian(student) {
    const values = emailValuesForStudents([student], "both");
    if (!values.length) { setNotice(`No student or guardian email is available for ${student.displayName}.`); return; }
    await navigator.clipboard?.writeText(values.join(", "));
    setNotice(`${values.length} synthetic student + guardian emails copied for ${student.displayName}.`);
  }

  function exportList() {
    const chosen = STUDENTS.filter((student) => selectedIds.includes(student.id));
    if (!chosen.length) { setNotice("Select at least one student first."); return; }
    const lines = ["Student,Grade,Ensembles,Program instrument,School email,Personal email,Student mobile,Guardian,Guardian email,Guardian phone"];
    for (const student of chosen) lines.push([
      student.displayName, student.grade, student.ensembles.join(" + "), student.programInstrument,
      student.schoolEmail, student.personalEmail, student.mobile, student.guardian.name,
      student.guardian.email, student.guardian.phone
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "synthetic-current-students.csv"; anchor.click(); URL.revokeObjectURL(url);
    setNotice(`${chosen.length} synthetic contact rows exported.`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav><Link href="/admin/operations-prototype">Command center</Link><span className={styles.prototypeBadge}>Prototype · Synthetic data</span></nav>
      </header>

      <section className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Current operations</p>
          <h1>{view === "active" ? "Current Students" : "Inactive Students"}</h1>
          <p>{pool.length} {view === "active" ? "active" : "inactive"} students</p>
        </div>
        <div className={styles.viewSwitch} aria-label="Student status view">
          <button className={view === "active" ? styles.activeView : ""} onClick={() => changeView("active")}>Current <span>{currentCount}</span></button>
          <button className={view === "inactive" ? styles.activeView : ""} onClick={() => changeView("inactive")}>Inactive <span>{inactiveCount}</span></button>
        </div>
      </section>

      <section className={styles.signalBar} aria-label="Roster signals">
        <div><span>Showing</span><strong>{filtered.length}</strong></div>
        <div><span>Needs follow-up</span><strong className={followUpCount ? styles.warnText : ""}>{followUpCount}</strong></div>
        <div><span>Contact gaps</span><strong className={contactGapCount ? styles.warnText : ""}>{contactGapCount}</strong></div>
        <p>Read-only prototype. Nothing is saved or sent.</p>
      </section>

      <div className={`${styles.workspace} ${focusedStudent ? styles.withDetail : ""}`}>
        <aside className={styles.filters} aria-label="Student filters">
          <div className={styles.filterHeading}><strong>Filter</strong><button onClick={clearFilters}>Clear</button></div>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, guardian, email…" /></label>
          <FilterSelect label="Grade" value={grade} onChange={setGrade} options={options.grades} />
          <FilterSelect label="Ensemble" value={ensemble} onChange={setEnsemble} options={options.ensembles} />
          <FilterSelect label="Program instrument" value={instrument} onChange={setInstrument} options={options.instruments} />
          <FilterSelect label="Open need" value={need} onChange={setNeed} options={options.needs} />
          <div className={styles.filterNote}><strong>Filters combine.</strong><span>Every choice narrows the roster. Sort changes the order.</span></div>
        </aside>

        <section className={styles.rosterPanel} aria-label="Student roster">
          <div className={styles.rosterToolbar}>
            <div><strong>{filtered.length} students</strong><span>{selectedIds.length ? `${selectedIds.length} selected` : "Select rows to build a list"}</span></div>
            <div className={styles.rosterTools}>
              <label className={styles.sortControl}><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
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
                  <tr key={student.id} className={focusedStudent?.id === student.id ? styles.focusedRow : ""}>
                    <td className={styles.checkCell}><input type="checkbox" aria-label={`Select ${student.displayName}`} checked={selectedIds.includes(student.id)} onChange={() => toggleSelected(student.id)} /></td>
                    <td><button className={styles.studentButton} onClick={() => setFocusedId(student.id)}><strong>{student.displayName}</strong><span>{student.status === "inactive" ? student.inactiveReason : student.currentSchool}</span></button></td>
                    <td>{student.grade}</td>
                    <td><div className={styles.ensembleStack}>{student.ensembles.map((item) => <span key={item}>{item}</span>)}</div></td>
                    <td>{student.programInstrument}</td>
                    <td><div className={styles.signalStack}>
                      <span className={contactReady(student) ? styles.goodSignal : styles.gapSignal}>{contactReady(student) ? "Contact ready" : "Contact gap"}</span>
                      {student.needs.map((item) => <span key={item} className={styles.needSignal}>{item}</span>)}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? <div className={styles.empty}><strong>No students match.</strong><button onClick={clearFilters}>Clear filters</button></div> : null}
          </div>
        </section>

        {focusedStudent ? <StudentDetail student={focusedStudent} onClose={() => setFocusedId("")} onCopyContacts={() => copyStudentAndGuardian(focusedStudent)} /> : null}
      </div>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option>{ALL}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function StudentDetail({ student, onClose, onCopyContacts }) {
  const [attended, total] = student.attendance;
  const [raised, goal] = student.funding;
  const [formsComplete, formsTotal] = student.forms;
  return (
    <aside className={styles.detail} aria-label={`${student.displayName} details`}>
      <header>
        <div><span>{student.status === "active" ? "Current student" : student.inactiveReason}</span><h2>{student.displayName}</h2>{student.pronouns ? <p>Pronouns · {student.pronouns}</p> : null}</div>
        <button onClick={onClose} aria-label="Close student details">×</button>
      </header>

      <DetailSection title="Identity">
        <DetailLine label="Legal name" value={student.legalName} />
        <DetailLine label="Grade" value={student.grade} />
        <DetailLine label="Current school" value={student.currentSchool || "Not current"} />
      </DetailSection>

      <DetailSection title="Current program">
        <DetailLine label="Ensembles" value={student.ensembles.join(", ")} />
        <DetailLine label="Program instrument" value={student.programInstrument} />
        <DetailLine label="Marching role" value={student.marchingRole || "Not marching"} />
      </DetailSection>

      <DetailSection title="Music background">
        <DetailLine label="Primary instrument" value={student.primaryInstrument} />
        <DetailLine label="Other instruments" value={student.otherInstruments.join(", ") || "None listed"} />
        <DetailLine label="Previous school" value={student.previousSchool} />
      </DetailSection>

      <DetailSection title="Family and contact">
        <DetailLine label="School email" value={student.schoolEmail || "Missing"} />
        <DetailLine label="Personal email" value={student.personalEmail || "Not provided"} />
        <DetailLine label="Student mobile" value={student.mobile || "Not provided"} />
        <div className={styles.guardianCard}><span>Primary + emergency</span><strong>{student.guardian.name}</strong><p>{student.guardian.relationship} · {student.guardian.email || "No email"} · {student.guardian.phone || "No phone"}</p></div>
        <button className={styles.detailContactAction} onClick={onCopyContacts}>Copy student + guardian emails</button>
      </DetailSection>

      <DetailSection title="Connected work">
        <div className={styles.workGrid}>
          <WorkCard label="Attendance" value={`${attended} of ${total}`} href={"/admin/attendance-workspace-prototype?student=" + encodeURIComponent(student.id)} />
          <WorkCard label="Funding" value={goal ? `$${raised} of $${goal}` : "No goal"} href={"/admin/operations-prototype?area=funding&student=" + encodeURIComponent(student.id)} />
          <WorkCard label="Forms" value={`${formsComplete} of ${formsTotal}`} href={"/admin/operations-prototype?area=forms&student=" + encodeURIComponent(student.id)} />
          <WorkCard label="Assets" value={student.assets.length ? `${student.assets.length} assigned` : "None"} href={"/admin/assets-inventory-prototype?student=" + encodeURIComponent(student.id)} />
          <WorkCard label="Memberships" value={`${student.ensembles.length} current`} href={"/admin/ensembles-memberships-prototype?student=" + encodeURIComponent(student.id)} />
        </div>
        {student.needs.length ? <div className={styles.openNeeds}><span>Open follow-up</span><ul>{student.needs.map((item) => <li key={item}><strong>{item}</strong><small>{needDescription(student, item)}</small></li>)}</ul></div> : <div className={styles.clearNeeds}>No open follow-up</div>}
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
