"use client";

import Link from "next/link";
import { useState } from "react";
import { STUDENTS } from "../current-students-prototype/CurrentStudentsPrototype";
import styles from "./operations-prototype.module.css";

const ACTIVE = STUDENTS.filter((student) => student.status === "active");
const SHIRT_UNPAID = new Set(["sage-linden", "elena-brook", "noah-quill"]);
const FORM_NAMES = {
  "milo-harbor": ["Medical form"],
  "elena-brook": ["Instrument agreement", "Photo release"],
  "noah-quill": ["Trip acknowledgement"]
};
const EVENTS = [
  { id: "football", date: "Sep 11", title: "Football vs. Fike", group: "Marching Band", students: 9, task: "Take attendance" },
  { id: "rehearsal", date: "Sep 15", title: "Marching rehearsal", group: "Marching Band", students: 9, task: "Open event roster" },
  { id: "fundraiser", date: "Sep 26", title: "Mattress fundraiser", group: "All families", students: 12, task: "Open audience" },
  { id: "concert", date: "Oct 8", title: "Fall concert", group: "Wind + Concert", students: 12, task: "Check forms" }
];
const AVAILABLE_ASSETS = [
  { id: "tp-204", name: "School trumpet 204", category: "Instrument", instrument: "Trumpet", status: "Available", studentId: "", tag: "TP-204" },
  { id: "tp-206", name: "School trumpet 206", category: "Instrument", instrument: "Trumpet", status: "Repair", studentId: "", tag: "TP-206" },
  { id: "tn-042", name: "Tuner 42", category: "Tuner", instrument: "", status: "Available", studentId: "", tag: "TN-042" }
];

function assetCategory(asset) {
  if (asset.startsWith("School ")) return "Instrument";
  if (asset.startsWith("Tuner ")) return "Tuner";
  if (asset.toLowerCase().includes("locker")) return "Locker";
  return "Equipment";
}

function assetInstrument(asset) {
  if (!asset.startsWith("School ")) return "";
  return asset.slice("School ".length).replace(/^bass /, "Bass ").replace(/^horn$/, "French Horn").replace(/^tuba$/, "Tuba").replace(/^trumpet$/, "Trumpet");
}

const ASSIGNED_ASSETS = ACTIVE.flatMap((student) => student.assets.map((asset, index) => ({
  id: student.id + "-" + index,
  name: asset,
  category: assetCategory(asset),
  instrument: assetInstrument(asset),
  status: "Checked out",
  studentId: student.id,
  tag: (assetCategory(asset).slice(0, 2) + "-" + student.id.slice(0, 3) + (index + 1)).toUpperCase()
})));
const INVENTORY = [...ASSIGNED_ASSETS, ...AVAILABLE_ASSETS];
const ENSEMBLES = [...new Set(ACTIVE.flatMap((student) => student.ensembles))].sort();
const DEDICATED_ROUTES = {
  attendance: "/admin/attendance-workspace-prototype",
  inventory: "/admin/assets-inventory-prototype",
  ensembles: "/admin/ensembles-memberships-prototype"
};

const AREAS = [
  { id: "students", number: ACTIVE.length, unit: "current students", title: "Students", prompt: "Find anyone or build a roster.", description: "Search the current program and move into one whole-student picture.", accent: "garnet" },
  { id: "attendance", number: ACTIVE.filter((student) => student.attendance[0] / student.attendance[1] < .9).length, unit: "below 90%", title: "Attendance", prompt: "Take attendance or find a pattern.", description: "Begin with an event, a group, or an attendance concern.", accent: "amber" },
  { id: "funding", number: ACTIVE.filter((student) => student.funding[1] && student.funding[0] < 100).length, unit: "under $100", title: "Funding & money", prompt: "See campaign attribution and program charges.", description: "Start with a financial question, then narrow to the students behind it. Donations and student charges stay separate.", accent: "green" },
  { id: "forms", number: ACTIVE.filter((student) => student.forms[0] < student.forms[1]).length, unit: "incomplete", title: "Forms", prompt: "Find exactly what is missing.", description: "See every incomplete requirement or one student’s exact missing items.", accent: "blue" },
  { id: "inventory", number: ACTIVE.filter((student) => student.assets.some((asset) => asset.startsWith("School "))).length, unit: "school instruments out", title: "Assets & inventory", prompt: "Track instruments, lockers, and equipment.", description: "Start with an asset type, an availability question, or one student’s assignments.", accent: "purple" },
  { id: "ensembles", number: ENSEMBLES.length, unit: "current groups", title: "Ensembles", prompt: "Open a program roster.", description: "Begin with the group and move directly to any member.", accent: "garnet" },
  { id: "calendar", number: EVENTS.length, unit: "upcoming events", title: "Calendar & events", prompt: "Start with the event and its people.", description: "Open an event, its roster, attendance, forms, and communication needs.", accent: "amber" },
  { id: "communication", number: ACTIVE.filter((student) => !student.schoolEmail || !student.guardian.email || !student.guardian.phone).length, unit: "contact gaps", title: "Communication", prompt: "Build the right audience.", description: "Start with the people you need to reach and verify the contact path.", accent: "green" }
];

const FILTERS = {
  students: [["all", "All current"], ["followup", "Open follow-up"], ["contact", "Contact gaps"]],
  attendance: [["all", "All current"], ["below90", "Below 90%"], ["missed2", "Missed 2+"]],
  funding: [["all", "All current"], ["under100", "Raised under $100"], ["shirt", "T-shirt unpaid"], ["goal", "Goal reached"]],
  forms: [["incomplete", "Incomplete"], ["all", "All current"]],
  inventory: [["all", "All assets"], ["instruments", "School instruments"], ["trumpets", "Trumpets"], ["tuners", "Tuners"], ["available", "Available"]],
  ensembles: [["all", "All ensembles"]],
  calendar: [["all", "Upcoming events"]],
  communication: [["all", "All current"], ["gaps", "Contact gaps"]]
};

export default function OperationsPrototype({ initialArea = "home", initialStudentId = "", initialFilter = "" }) {
  const safeArea = AREAS.some((item) => item.id === initialArea) ? initialArea : "home";
  const safeStudent = ACTIVE.some((student) => student.id === initialStudentId) ? initialStudentId : "";
  const defaultFilter = initialFilter || (safeArea === "forms" ? "incomplete" : "all");
  const [area, setArea] = useState(safeArea);
  const [studentId, setStudentId] = useState(safeStudent);
  const [filter, setFilter] = useState(defaultFilter);
  const [assetId, setAssetId] = useState("");
  const student = ACTIVE.find((item) => item.id === studentId) || null;

  function writeLocation(nextArea, nextStudent, nextFilter) {
    const params = new URLSearchParams();
    if (nextArea !== "home") params.set("area", nextArea);
    if (nextStudent) params.set("student", nextStudent);
    if (nextFilter && nextFilter !== "all") params.set("filter", nextFilter);
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }

  function openArea(nextArea, nextStudent = studentId, nextFilter = nextArea === "forms" ? "incomplete" : "all") {
    setArea(nextArea);
    setStudentId(nextStudent);
    setFilter(nextFilter);
    setAssetId("");
    writeLocation(nextArea, nextStudent, nextFilter);
  }

  function changeFilter(nextFilter) {
    setFilter(nextFilter);
    setAssetId("");
    writeLocation(area, studentId, nextFilter);
  }

  function scopeStudent(nextStudentId) {
    setStudentId(nextStudentId);
    setAssetId("");
    writeLocation(area, nextStudentId, filter);
  }

  function clearStudent() {
    setStudentId("");
    setAssetId("");
    writeLocation(area, "", filter);
  }

  if (area === "home") return <Home onOpenArea={(nextArea) => openArea(nextArea, "")} />;

  const selectedArea = AREAS.find((item) => item.id === area);
  return (
    <main className={styles.page}>
      <Header onHome={() => openArea("home", "")} student={student} />
      <section className={styles.areaHeading}>
        <div>
          <button className={styles.back} onClick={() => openArea("home", "")}>← Command center</button>
          <p className={styles.eyebrow}>Operational area</p>
          <h1>{selectedArea.title}</h1>
          <p>{selectedArea.description}</p>
        </div>
        <span className={styles.areaCount}><strong>{selectedArea.number}</strong>{selectedArea.unit}</span>
      </section>

      {student ? <StudentScope student={student} area={selectedArea.title} onClear={clearStudent} /> : null}

      <section className={styles.areaWorkspace}>
        <aside className={styles.questionRail}>
          <strong>{student ? "This student" : "Questions"}</strong>
          <div className={styles.filterButtons}>
            {(FILTERS[area] || []).map(([value, label]) => (
              <button key={value} className={filter === value ? styles.activeFilter : ""} onClick={() => changeFilter(value)}>{label}</button>
            ))}
          </div>
          <p>{student ? "Clear the student to ask the same question across the full program." : "Choose the question that matches what you need right now."}</p>
        </aside>

        <section className={styles.resultsPanel}>
          <AreaResults
            area={area}
            filter={filter}
            student={student}
            onScopeStudent={scopeStudent}
            assetId={assetId}
            onAsset={setAssetId}
            onShowTrumpets={() => {
              setStudentId("");
              setFilter("trumpets");
              setAssetId("");
              writeLocation("inventory", "", "trumpets");
            }}
            onOpenArea={openArea}
          />
        </section>
      </section>

      {student ? <Connections student={student} currentArea={area} onOpenArea={openArea} /> : null}
    </main>
  );
}

function Home({ onOpenArea }) {
  return (
    <main className={styles.page}>
      <Header />
      <section className={styles.heading}>
        <div><p className={styles.eyebrow}>Staff command center</p><h1>What do you need to work on?</h1></div>
        <p>Start with the program, an operational area, or a student. Every route reconnects to the same records.</p>
      </section>
      <section className={styles.areaGrid} aria-label="Operational areas">
        {AREAS.map((item) => DEDICATED_ROUTES[item.id] ? (
          <Link key={item.id} href={DEDICATED_ROUTES[item.id]} className={styles.areaCard} data-accent={item.accent}>
            <span className={styles.areaMetric}><strong>{item.number}</strong> {item.unit}</span>
            <span className={styles.areaTitle}>{item.title}<b>→</b></span>
            <span className={styles.areaPrompt}>{item.prompt}</span>
          </Link>
        ) : (
          <button key={item.id} className={styles.areaCard} data-accent={item.accent} onClick={() => onOpenArea(item.id)}>
            <span className={styles.areaMetric}><strong>{item.number}</strong> {item.unit}</span>
            <span className={styles.areaTitle}>{item.title}<b>→</b></span>
            <span className={styles.areaPrompt}>{item.prompt}</span>
          </button>
        ))}
      </section>
      <section className={styles.routeNote}>
        <strong>Two valid directions</strong>
        <span>Open Funding to find everyone under $100, or arrive from Avery and see only Avery&apos;s financial picture.</span>
      </section>
    </main>
  );
}

function Header({ onHome, student }) {
  const studentHref = student ? "/admin/current-students-prototype?student=" + encodeURIComponent(student.id) : "/admin/current-students-prototype";
  return (
    <header className={styles.appBar}>
      <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
      <nav>
        {onHome ? <button onClick={onHome}>Command center</button> : null}
        <Link href={studentHref}>{student ? "Open " + student.displayName : "Current students"}</Link>
        <span className={styles.prototypeBadge}>Prototype · Synthetic data</span>
      </nav>
    </header>
  );
}

function StudentScope({ student, area, onClear }) {
  return (
    <section className={styles.scopeBar}>
      <div><span>Student context retained</span><strong>{student.displayName}</strong><p>Showing {area.toLowerCase()} for this student.</p></div>
      <div><Link href={"/admin/current-students-prototype?student=" + encodeURIComponent(student.id)}>Open full student</Link><button onClick={onClear}>Show full program</button></div>
    </section>
  );
}

function Connections({ student, currentArea, onOpenArea }) {
  const related = ["attendance", "funding", "forms", "inventory", "ensembles"].filter((item) => item !== currentArea);
  return (
    <section className={styles.connections}>
      <div><span>Keep {student.displayName}</span><strong>Move across the connected record</strong></div>
      <div>{related.map((area) => {
        if (area === "attendance") return <Link key={area} href={`/admin/attendance-workspace-prototype?student=${encodeURIComponent(student.id)}`}>Attendance →</Link>;
        if (area === "inventory") return <Link key={area} href={`/admin/assets-inventory-prototype?student=${encodeURIComponent(student.id)}`}>Assets & inventory →</Link>;
        if (area === "ensembles") return <Link key={area} href={`/admin/ensembles-memberships-prototype?student=${encodeURIComponent(student.id)}`}>Ensembles →</Link>;
        return <button key={area} onClick={() => onOpenArea(area, student.id)}>{AREAS.find((item) => item.id === area).title} →</button>;
      })}</div>
    </section>
  );
}

function AreaResults(props) {
  if (props.area === "students") return <StudentsResults {...props} />;
  if (props.area === "attendance") return <AttendanceResults {...props} />;
  if (props.area === "funding") return <FundingResults {...props} />;
  if (props.area === "forms") return <FormsResults {...props} />;
  if (props.area === "inventory") return <InventoryResults {...props} />;
  if (props.area === "ensembles") return <EnsembleResults />;
  if (props.area === "calendar") return <CalendarResults onOpenArea={props.onOpenArea} />;
  return <CommunicationResults {...props} />;
}

function StudentsResults({ filter, student }) {
  const rows = (student ? [student] : ACTIVE).filter((item) => {
    if (filter === "followup") return item.needs.length > 0;
    if (filter === "contact") return !item.schoolEmail || !item.guardian.email || !item.guardian.phone;
    return true;
  });
  return (
    <ResultTable title="Current student roster" count={rows.length}>
      <table><thead><tr><th>Student</th><th>Grade</th><th>Ensembles</th><th>Open work</th><th></th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{item.grade}</td><td>{item.ensembles.join(" · ")}</td><td>{item.needs.join(" · ") || "Clear"}</td><td><StudentLink student={item}>Open student</StudentLink></td></tr>)}</tbody>
      </table>
    </ResultTable>
  );
}

function AttendanceResults({ filter, student, onScopeStudent }) {
  const rows = (student ? [student] : ACTIVE).filter((item) => {
    const missed = item.attendance[1] - item.attendance[0];
    const rate = item.attendance[0] / item.attendance[1];
    if (filter === "below90") return rate < .9;
    if (filter === "missed2") return missed >= 2;
    return true;
  });
  return (
    <ResultTable title={student ? student.displayName + " · attendance" : "Current attendance"} count={rows.length}>
      <table><thead><tr><th>Student</th><th>Present</th><th>Missed</th><th>Rate</th><th></th></tr></thead>
        <tbody>{rows.map((item) => {
          const missed = item.attendance[1] - item.attendance[0];
          const rate = Math.round(item.attendance[0] / item.attendance[1] * 100);
          return <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{item.attendance[0]} of {item.attendance[1]}</td><td>{missed}</td><td><Status tone={rate < 90 ? "warn" : "good"}>{rate}%</Status></td><td>{student ? <StudentLink student={item}>Full student</StudentLink> : <button className={styles.rowAction} onClick={() => onScopeStudent(item.id)}>Open attendance</button>}</td></tr>;
        })}</tbody>
      </table>
    </ResultTable>
  );
}

function FundingResults({ filter, student, onScopeStudent }) {
  const rows = (student ? [student] : ACTIVE).filter((item) => {
    const [raised, goal] = item.funding;
    if (filter === "under100") return goal > 0 && raised < 100;
    if (filter === "shirt") return SHIRT_UNPAID.has(item.id);
    if (filter === "goal") return goal > 0 && raised >= goal;
    return true;
  });
  return (
    <>
      {student ? <FundingLedger student={student} /> : null}
      <ResultTable title={student ? "Financial summary" : "Program financial view"} count={rows.length}>
        <table><thead><tr><th>Student</th><th>Campaign attributed</th><th>Goal</th><th>To goal</th><th>T-shirt charge</th><th></th></tr></thead>
          <tbody>{rows.map((item) => {
            const [raised, goal] = item.funding;
            const remaining = Math.max(goal - raised, 0);
            return <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{"$" + raised}</td><td>{goal ? "$" + goal : "No goal"}</td><td>{goal ? "$" + remaining : "—"}</td><td><Status tone={SHIRT_UNPAID.has(item.id) ? "warn" : "good"}>{SHIRT_UNPAID.has(item.id) ? "Unpaid" : "Paid"}</Status></td><td>{student ? <StudentLink student={item}>Full student</StudentLink> : <button className={styles.rowAction} onClick={() => onScopeStudent(item.id)}>Open ledger</button>}</td></tr>;
          })}</tbody>
        </table>
      </ResultTable>
    </>
  );
}

function FundingLedger({ student }) {
  const [raised, goal] = student.funding;
  return (
    <section className={styles.focusPanel}>
      <div><span>Student financial picture</span><h2>{student.displayName}</h2></div>
      <div className={styles.summaryCells}>
        <div><span>Campaign attribution</span><strong>{"$" + raised + " of $" + (goal || 0)}</strong></div>
        <div><span>Program charges</span><strong>{SHIRT_UNPAID.has(student.id) ? "T-shirt · $25" : "None open"}</strong></div>
        <div><span>Open charges</span><strong>{SHIRT_UNPAID.has(student.id) ? "$25" : "$0"}</strong></div>
      </div>
      <div className={styles.ledgerRows}><span>Campaign activity · program donations</span><p><b>Family sponsorship attribution</b><strong>+$100 attributed</strong></p><p><b>Student campaign activity</b><strong>+$75 attributed</strong></p></div>
      <div className={styles.ledgerRows}><span>Program charges</span><p><b>Program T-shirt</b><strong>{SHIRT_UNPAID.has(student.id) ? "$25 due" : "Paid"}</strong></p></div>
    </section>
  );
}

function FormsResults({ filter, student, onScopeStudent }) {
  const rows = (student ? [student] : ACTIVE).filter((item) => filter !== "incomplete" || item.forms[0] < item.forms[1]);
  return (
    <ResultTable title={student ? student.displayName + " · forms" : "Form completion"} count={rows.length}>
      <table><thead><tr><th>Student</th><th>Complete</th><th>Missing</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map((item) => {
          const missing = FORM_NAMES[item.id] || [];
          return <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{item.forms[0]} of {item.forms[1]}</td><td>{missing.join(" · ") || "None"}</td><td><Status tone={missing.length ? "warn" : "good"}>{missing.length ? missing.length + " missing" : "Complete"}</Status></td><td>{student ? <StudentLink student={item}>Full student</StudentLink> : <button className={styles.rowAction} onClick={() => onScopeStudent(item.id)}>Open forms</button>}</td></tr>;
        })}</tbody>
      </table>
    </ResultTable>
  );
}

function InventoryResults({ filter, student, onScopeStudent, assetId, onAsset, onShowTrumpets }) {
  const rows = INVENTORY.filter((asset) => {
    if (student && asset.studentId !== student.id) return false;
    if (filter === "instruments" && asset.category !== "Instrument") return false;
    if (filter === "trumpets" && asset.instrument !== "Trumpet") return false;
    if (filter === "tuners" && asset.category !== "Tuner") return false;
    if (filter === "available" && asset.status !== "Available") return false;
    return true;
  });
  const focusedAsset = INVENTORY.find((asset) => asset.id === assetId);
  return (
    <>
      {focusedAsset ? <AssetDetail asset={focusedAsset} onShowTrumpets={onShowTrumpets} /> : null}
      <ResultTable title={student ? student.displayName + " · assigned assets" : "Program inventory"} count={rows.length}>
        <table><thead><tr><th>Asset</th><th>Type</th><th>Status</th><th>Assigned to</th><th></th></tr></thead>
          <tbody>{rows.map((asset) => {
            const owner = ACTIVE.find((item) => item.id === asset.studentId);
            return <tr key={asset.id}><td><button className={styles.assetButton} onClick={() => onAsset(asset.id)}><strong>{asset.name}</strong><span>{asset.tag}</span></button></td><td>{asset.instrument || asset.category}</td><td><Status tone={asset.status === "Available" ? "good" : asset.status === "Repair" ? "warn" : "plain"}>{asset.status}</Status></td><td>{owner ? owner.displayName : "Unassigned"}</td><td>{owner && !student ? <button className={styles.rowAction} onClick={() => onScopeStudent(owner.id)}>Open assignment</button> : owner ? <StudentLink student={owner}>Full student</StudentLink> : "—"}</td></tr>;
          })}</tbody>
        </table>
      </ResultTable>
    </>
  );
}

function AssetDetail({ asset, onShowTrumpets }) {
  const owner = ACTIVE.find((item) => item.id === asset.studentId);
  return (
    <section className={styles.focusPanel}>
      <div><span>Asset record</span><h2>{asset.name}</h2></div>
      <div className={styles.summaryCells}>
        <div><span>Asset tag</span><strong>{asset.tag}</strong></div>
        <div><span>Status</span><strong>{asset.status}</strong></div>
        <div><span>Assigned to</span><strong>{owner ? owner.displayName : "Unassigned"}</strong></div>
      </div>
      {asset.instrument === "Trumpet" ? <button className={styles.focusAction} onClick={onShowTrumpets}>Show all trumpets →</button> : null}
    </section>
  );
}

function EnsembleResults() {
  return (
    <ResultTable title="Current ensembles" count={ENSEMBLES.length}>
      <table><thead><tr><th>Ensemble</th><th>Students</th><th>Roster</th></tr></thead>
        <tbody>{ENSEMBLES.map((ensemble) => {
          const members = ACTIVE.filter((student) => student.ensembles.includes(ensemble));
          return <tr key={ensemble}><td><strong>{ensemble}</strong></td><td>{members.length}</td><td><div className={styles.studentLinks}>{members.map((student) => <StudentLink key={student.id} student={student}>{student.displayName}</StudentLink>)}</div></td></tr>;
        })}</tbody>
      </table>
    </ResultTable>
  );
}

function CalendarResults({ onOpenArea }) {
  return (
    <ResultTable title="Upcoming program events" count={EVENTS.length}>
      <table><thead><tr><th>Date</th><th>Event</th><th>Group</th><th>Roster</th><th></th></tr></thead>
        <tbody>{EVENTS.map((event) => <tr key={event.id}><td><strong>{event.date}</strong></td><td>{event.title}</td><td>{event.group}</td><td>{event.students} students</td><td><button className={styles.rowAction} onClick={() => onOpenArea(event.id === "concert" ? "forms" : "attendance", "")}>{event.task}</button></td></tr>)}</tbody>
      </table>
    </ResultTable>
  );
}

function CommunicationResults({ filter, student, onScopeStudent }) {
  const rows = (student ? [student] : ACTIVE).filter((item) => filter !== "gaps" || !item.schoolEmail || !item.guardian.email || !item.guardian.phone);
  return (
    <ResultTable title={student ? student.displayName + " · contact paths" : "Current contact readiness"} count={rows.length}>
      <table><thead><tr><th>Student</th><th>School email</th><th>Guardian</th><th>Readiness</th><th></th></tr></thead>
        <tbody>{rows.map((item) => {
          const ready = Boolean(item.schoolEmail && item.guardian.email && item.guardian.phone);
          return <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{item.schoolEmail || "Missing"}</td><td>{item.guardian.email || "Missing"}</td><td><Status tone={ready ? "good" : "warn"}>{ready ? "Ready" : "Gap"}</Status></td><td>{student ? <StudentLink student={item}>Full student</StudentLink> : <button className={styles.rowAction} onClick={() => onScopeStudent(item.id)}>Open contacts</button>}</td></tr>;
        })}</tbody>
      </table>
    </ResultTable>
  );
}

function ResultTable({ title, count, children }) {
  return <div><header className={styles.resultHeader}><div><strong>{title}</strong><span>{count} result{count === 1 ? "" : "s"}</span></div><span>Read-only prototype</span></header><div className={styles.tableWrap}>{children}</div></div>;
}

function StudentLink({ student, children }) {
  return <Link className={styles.rowLink} href={"/admin/current-students-prototype?student=" + encodeURIComponent(student.id)}>{children}</Link>;
}

function Status({ tone, children }) {
  return <span className={[styles.status, styles[tone]].filter(Boolean).join(" ")}>{children}</span>;
}
