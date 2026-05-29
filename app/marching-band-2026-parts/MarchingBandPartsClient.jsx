"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ashley_mb_2026_part_assignments_v1";

const STATUS_LABELS = {
  signed_up: "Signed up",
  intends: "Interested",
  band_only: "Band class only",
  out: "Not participating"
};

function readAssignments() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAssignments(assignments) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

function studentKey(student) {
  return student.sourceStudentId || student.email || student.name;
}

function flattenMarchers(sections) {
  return sections.flatMap((section) => section.students.map((student) => ({ ...student, sectionName: section.name })));
}

function StatusPill({ status, label }) {
  return <span className={`parts-status parts-status-${status}`}>{label || STATUS_LABELS[status] || status}</span>;
}

function PartSelect({ student, partOptions, value, savedValue, onChange, onSave }) {
  const dirty = value !== savedValue;

  return (
    <div className="part-control">
      <select value={value} onChange={(event) => onChange(studentKey(student), event.target.value)}>
        <option value="">TBD</option>
        {partOptions.map((part) => <option key={part} value={part}>{part}</option>)}
      </select>
      <button type="button" onClick={() => onSave(studentKey(student))} disabled={!dirty}>
        {dirty ? "Update" : "Saved"}
      </button>
    </div>
  );
}

function EditableRow({ student, partOptions, draftAssignments, savedAssignments, onChange, onSave }) {
  const key = studentKey(student);
  const suggestedPart = student.assignedPart && student.assignedPart !== "TBD"
    ? student.assignedPart
    : student.partOptions?.[0] || "";
  const savedValue = savedAssignments[key] ?? suggestedPart;
  const value = draftAssignments[key] ?? savedValue;

  return (
    <tr>
      <td>
        <strong>{student.name}</strong>
        <span>{student.grade || "No grade"}{student.instrument ? ` · ${student.instrument}` : ""}</span>
      </td>
      <td>{student.sectionName}</td>
      <td>
        <StatusPill status={student.status} label={student.statusLabel} />
      </td>
      <td className="suggested-cell">{student.partOptions?.join(" / ") || "TBD"}</td>
      <td>
        <PartSelect
          student={student}
          partOptions={partOptions}
          value={value}
          savedValue={savedValue}
          onChange={onChange}
          onSave={onSave}
        />
      </td>
    </tr>
  );
}

function StaticList({ title, note, students, status }) {
  return (
    <section className="parts-panel compact-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Marching Band 2026</p>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        <strong>{students.length}</strong>
      </div>
      <div className="name-grid">
        {students.map((student) => (
          <div className="name-row" key={student.name}>
            <span>{student.name}</span>
            <StatusPill status={student.status || status} label={student.statusLabel} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MarchingBandPartsClient({ partsData }) {
  const marchers = useMemo(() => flattenMarchers(partsData.sections), [partsData.sections]);
  const bandOnlyStudents = useMemo(
    () => partsData.notMarchingBand.filter((student) => student.status === "band_only"),
    [partsData.notMarchingBand]
  );
  const outStudents = useMemo(
    () => partsData.notMarchingBand.filter((student) => student.status === "out"),
    [partsData.notMarchingBand]
  );
  const partOptions = useMemo(() => {
    const extras = ["Drum Major / Conductor", "Colorguard"];
    return Array.from(new Set([...partsData.partList, ...extras])).sort((a, b) => a.localeCompare(b));
  }, [partsData.partList]);

  const [savedAssignments, setSavedAssignments] = useState({});
  const [draftAssignments, setDraftAssignments] = useState({});
  const [filter, setFilter] = useState({ section: "", search: "" });

  useEffect(() => {
    const stored = readAssignments();
    setSavedAssignments(stored);
    setDraftAssignments(stored);
  }, []);

  function changeAssignment(key, value) {
    setDraftAssignments((current) => ({ ...current, [key]: value }));
  }

  function saveAssignment(key) {
    setSavedAssignments((current) => {
      const next = { ...current, [key]: draftAssignments[key] || "" };
      writeAssignments(next);
      return next;
    });
  }

  const filteredMarchers = useMemo(() => {
    const term = filter.search.trim().toLowerCase();
    return marchers.filter((student) => {
      if (filter.section && student.sectionName !== filter.section) return false;
      if (!term) return true;
      return [student.name, student.grade, student.instrument, student.sectionName, student.partOptions?.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [filter, marchers]);

  return (
    <main className="parts-dashboard">
      <section className="parts-panel dashboard-panel">
        <header className="dashboard-head">
          <div>
            <p className="eyebrow">Ashley Bands · Screaming Eagle Regiment</p>
            <h1>{partsData.title}</h1>
            <p>Compact part-assignment dashboard. Dropdown updates are saved on this device.</p>
          </div>
          <div className="summary-strip">
            <div><strong>{partsData.summary.signedUp}</strong><span>signed up</span></div>
            <div><strong>{partsData.summary.intends}</strong><span>interested</span></div>
            <div><strong>{partsData.summary.needsPrintedMusic}</strong><span>need music</span></div>
            <div><strong>{partsData.version}</strong><span>version</span></div>
          </div>
        </header>

        <div className="dashboard-filters">
          <label>
            <span>Section</span>
            <select value={filter.section} onChange={(event) => setFilter({ ...filter, section: event.target.value })}>
              <option value="">All sections</option>
              {partsData.sections.map((section) => <option key={section.name} value={section.name}>{section.name}</option>)}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.target.value })} placeholder="Name, instrument, part" />
          </label>
        </div>

        <div className="parts-table-wrap">
          <table className="parts-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Section</th>
                <th>Status</th>
                <th>Suggested</th>
                <th>Assigned Part</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarchers.map((student) => (
                <EditableRow
                  key={studentKey(student)}
                  student={student}
                  partOptions={partOptions}
                  draftAssignments={draftAssignments}
                  savedAssignments={savedAssignments}
                  onChange={changeAssignment}
                  onSave={saveAssignment}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="status-panels">
        <StaticList
          title="Band Class, Not Marching Band"
          note="Students currently listed for band class, but not the competitive marching band roster."
          students={bandOnlyStudents}
          status="band_only"
        />
        <StaticList
          title="Not Participating"
          note="Students currently marked as not participating."
          students={outStudents}
          status="out"
        />
      </div>

      <style>{`
        .parts-dashboard {
          min-height: 100vh;
          padding: 14px;
          background: #eef2f7;
          color: #111827;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .parts-panel {
          max-width: 1500px;
          margin: 0 auto;
          background: #fff;
          border: 1px solid #d9e2ef;
          border-radius: 10px;
          box-shadow: 0 10px 26px rgba(15,23,42,.08);
        }
        .dashboard-panel {
          min-height: 0;
          overflow: visible;
        }
        .dashboard-head {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(520px, .9fr);
          gap: 16px;
          align-items: start;
          padding: 14px 16px 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .eyebrow {
          margin: 0 0 4px;
          color: #2563eb;
          font-size: .7rem;
          font-weight: 900;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        h1, h2 {
          margin: 0;
          letter-spacing: 0;
          line-height: 1.05;
        }
        h1 {
          font-size: clamp(1.6rem, 3vw, 2.5rem);
        }
        h2 {
          font-size: 1.35rem;
        }
        .dashboard-head p, .panel-head p {
          margin: 6px 0 0;
          color: #64748b;
          font-size: .88rem;
        }
        .summary-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .summary-strip div {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
        }
        .summary-strip strong {
          display: block;
          font-size: 1.5rem;
          line-height: 1;
        }
        .summary-strip span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: .68rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .dashboard-filters {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 10px;
          padding: 10px 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        .dashboard-filters label {
          display: grid;
          gap: 4px;
        }
        .dashboard-filters span {
          color: #475569;
          font-size: .72rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .dashboard-filters select,
        .dashboard-filters input,
        .part-control select {
          width: 100%;
          min-height: 34px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          background: #fff;
          color: #111827;
          font: inherit;
          font-size: .9rem;
          padding: 6px 8px;
        }
        .parts-table-wrap {
          overflow: visible;
        }
        .parts-table {
          width: 100%;
          border-collapse: collapse;
          font-size: .86rem;
        }
        .parts-table th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #f8fafc;
          color: #475569;
          text-align: left;
          font-size: .68rem;
          letter-spacing: .08em;
          text-transform: uppercase;
          border-bottom: 1px solid #d9e2ef;
          padding: 8px 10px;
        }
        .parts-table td {
          border-bottom: 1px solid #edf2f7;
          padding: 7px 10px;
          vertical-align: middle;
        }
        .parts-table tr:hover td {
          background: #f8fafc;
        }
        .parts-table td:first-child strong {
          display: block;
          font-size: .92rem;
        }
        .parts-table td:first-child span {
          display: block;
          margin-top: 1px;
          color: #64748b;
          font-size: .76rem;
        }
        .suggested-cell {
          max-width: 280px;
          color: #475569;
          font-size: .76rem;
        }
        .part-control {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) 74px;
          gap: 6px;
        }
        .part-control button {
          border: 1px solid #0f172a;
          border-radius: 7px;
          background: #0f172a;
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }
        .part-control button:disabled {
          border-color: #cbd5e1;
          background: #f1f5f9;
          color: #64748b;
          cursor: default;
        }
        .parts-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: .66rem;
          font-weight: 900;
        }
        .parts-status-signed_up { background: #dcfce7; color: #166534; }
        .parts-status-intends { background: #fef9c3; color: #854d0e; }
        .parts-status-band_only { background: #e0f2fe; color: #075985; }
        .parts-status-out { background: #f1f5f9; color: #475569; }
        .status-panels {
          max-width: 1500px;
          margin: 14px auto 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .compact-panel {
          margin: 0;
          padding: 14px;
          min-height: calc(100vh - 104px);
        }
        .panel-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .panel-head > strong {
          min-width: 62px;
          text-align: center;
          border-radius: 8px;
          padding: 8px 10px;
          background: #0f172a;
          color: #fff;
          font-size: 1.5rem;
          line-height: 1;
        }
        .name-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
        }
        .name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 36px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 6px 8px;
        }
        .name-row span:first-child {
          font-weight: 850;
          font-size: .84rem;
          line-height: 1.1;
        }
        @media (max-width: 980px) {
          .dashboard-panel, .compact-panel {
            height: auto;
            min-height: auto;
          }
          .dashboard-head,
          .status-panels {
            grid-template-columns: 1fr;
          }
          .dashboard-filters {
            grid-template-columns: 1fr;
          }
          .parts-table {
            min-width: 900px;
          }
        }
        @media print {
          .site-header { display: none; }
          .parts-dashboard { padding: 0; background: #fff; }
          .parts-panel {
            max-width: none;
            box-shadow: none;
            border-radius: 0;
            page-break-after: always;
          }
        }
      `}</style>
    </main>
  );
}
