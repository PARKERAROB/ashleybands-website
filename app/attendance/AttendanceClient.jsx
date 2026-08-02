"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./attendance.module.css";

const STATUS = {
  present: { short: "P", label: "Present" },
  tardy: { short: "T", label: "Tardy" },
  absent: { short: "A", label: "Absent" }
};

export default function AttendanceClient() {
  const [access, setAccess] = useState("checking");
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(new Set());
  const [noteSaving, setNoteSaving] = useState(new Set());
  const [openNotes, setOpenNotes] = useState(new Set());
  const [noteDrafts, setNoteDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const hasLoaded = useRef(false);

  const loadRoster = useCallback(async ({ quiet = false } = {}) => {
    try {
      const response = await fetch("/api/attendance", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAccess("locked");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Attendance could not be loaded.");
      setStudents((current) => {
        if (!hasLoaded.current) return data.students || [];
        const savingIds = saving;
        const localById = new Map(current.map((student) => [student.id, student]));
        return (data.students || []).map((student) => savingIds.has(student.id)
          ? localById.get(student.id) || student
          : student);
      });
      hasLoaded.current = true;
      setLastSynced(new Date());
      setAccess("open");
      if (!quiet) setError("");
    } catch (loadError) {
      if (!quiet) setError(loadError.message);
    }
  }, [saving]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRoster(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRoster]);

  useEffect(() => {
    if (access !== "open") return undefined;
    const timer = window.setInterval(() => loadRoster({ quiet: true }), 15000);
    return () => window.clearInterval(timer);
  }, [access, loadRoster]);

  const counts = useMemo(() => students.reduce((total, student) => {
    total[student.status || "unmarked"] += 1;
    if (String(student.note || "").trim()) total.notes += 1;
    return total;
  }, { present: 0, tardy: 0, absent: 0, unmarked: 0, notes: 0 }), [students]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.name, student.section, student.assignment, student.grade, student.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)));
  }, [query, students]);

  const mark = async (studentId, status) => {
    const prior = students.find((student) => student.id === studentId)?.status || null;
    setNotice("");
    setError("");
    setStudents((current) => current.map((student) => student.id === studentId
      ? { ...student, status }
      : student));
    setSaving((current) => new Set(current).add(studentId));

    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status: status || "unmarked" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "That mark did not save.");
      setLastSynced(new Date());
    } catch (saveError) {
      setStudents((current) => current.map((student) => student.id === studentId
        ? { ...student, status: prior }
        : student));
      setError(saveError.message);
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(studentId);
        return next;
      });
    }
  };

  const toggleNote = (student) => {
    setOpenNotes((current) => {
      const next = new Set(current);
      if (next.has(student.id)) next.delete(student.id);
      else next.add(student.id);
      return next;
    });
    setNoteDrafts((current) => Object.prototype.hasOwnProperty.call(current, student.id)
      ? current
      : { ...current, [student.id]: student.note || "" });
  };

  const saveNote = async (studentId) => {
    const note = String(noteDrafts[studentId] || "").trim();
    setNoteSaving((current) => new Set(current).add(studentId));
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, note })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "That note did not save.");
      setStudents((current) => current.map((student) => student.id === studentId
        ? { ...student, note: data.note || "" }
        : student));
      setOpenNotes((current) => {
        const next = new Set(current);
        next.delete(studentId);
        return next;
      });
      setNotice(note ? "Staff note saved." : "Staff note cleared.");
      setLastSynced(new Date());
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setNoteSaving((current) => {
        const next = new Set(current);
        next.delete(studentId);
        return next;
      });
    }
  };

  const sendAbsentList = async () => {
    const absentCount = counts.absent;
    const noteCount = counts.notes;
    if (!absentCount && !noteCount) return;
    const confirmed = window.confirm(
      `Send Mr. Parker the current report with ${absentCount} marked absent and ${noteCount} staff note${noteCount === 1 ? "" : "s"}?`
    );
    if (!confirmed) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance/report", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The absent list could not be sent.");
      setNotice(`Sent Mr. Parker ${data.absentCount} marked absent and ${data.noteCount} staff note${data.noteCount === 1 ? "" : "s"}.`);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  if (access === "checking") {
    return <main className={styles.shell}><p className={styles.loading}>Opening attendance…</p></main>;
  }

  if (access === "locked") {
    return <AttendanceGate onOpen={() => { hasLoaded.current = false; loadRoster(); }} />;
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Ashley Bands · Private staff tool</p>
        <div className={styles.titleRow}>
          <div>
            <h1>Band Camp Day 1</h1>
            <p>Monday, August 3, 2026</p>
          </div>
          <button className={styles.signOut} type="button" onClick={async () => {
            await fetch("/api/attendance/access", { method: "DELETE" });
            setAccess("locked");
          }}>Lock</button>
        </div>
      </header>

      <section className={styles.toolbar} aria-label="Attendance summary">
        <div className={styles.counts}>
          <span><strong>{counts.unmarked}</strong> Unmarked</span>
          <span className={styles.presentCount}><strong>{counts.present}</strong> Present</span>
          <span className={styles.tardyCount}><strong>{counts.tardy}</strong> Tardy</span>
          <span className={styles.absentCount}><strong>{counts.absent}</strong> Absent</span>
        </div>
        <label className={styles.search}>
          <span className={styles.srOnly}>Find a student</span>
          <input
            type="search"
            inputMode="search"
            placeholder="Find name, section, or grade"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className={styles.syncLine} aria-live="polite">
          {saving.size ? `Saving ${saving.size}…` : lastSynced ? "Shared list is up to date" : "Loading shared list…"}
        </div>
      </section>

      {(error || notice) && (
        <div className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>
          {error || notice}
        </div>
      )}

      <div className={styles.listHeader}>
        <span>{visible.length} of {students.length} students</span>
        <span>Tap selected letter again to clear</span>
      </div>

      <section className={styles.roster} aria-label="Student attendance roster">
        {visible.map((student, index) => {
          const showSection = index === 0 || visible[index - 1].section !== student.section;
          return (
            <div key={student.id}>
              {showSection && (
                <h2 className={`${styles.sectionTitle} ${student.provisional ? styles.provisionalTitle : ""}`}>
                  {student.section}
                </h2>
              )}
              <article className={`${styles.student} ${student.provisional ? styles.provisionalStudent : ""}`}>
                <div className={styles.studentMain}>
                  <div className={styles.identity}>
                    <h3>{student.name}</h3>
                    <p>
                      <span>Grade {student.grade}</span>
                      <span aria-hidden="true">·</span>
                      <span>{student.assignment || student.section}</span>
                    </p>
                  </div>
                  <div className={styles.statusGroup} aria-label={`Attendance for ${student.name}`}>
                    {Object.entries(STATUS).map(([value, option]) => (
                      <button
                        key={value}
                        type="button"
                        className={`${styles.statusButton} ${styles[value]} ${student.status === value ? styles.selected : ""}`}
                        aria-label={`${student.name}: ${option.label}`}
                        aria-pressed={student.status === value}
                        disabled={saving.has(student.id)}
                        onClick={() => mark(student.id, student.status === value ? null : value)}
                      >
                        <span aria-hidden="true">{option.short}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className={`${styles.noteToggle} ${student.note ? styles.hasNote : ""}`}
                  type="button"
                  aria-expanded={openNotes.has(student.id)}
                  onClick={() => toggleNote(student)}
                >
                  {student.note ? `Staff note: ${student.note}` : "+ Add staff note"}
                </button>
                {openNotes.has(student.id) && (
                  <div className={styles.noteEditor}>
                    <label htmlFor={`attendance-note-${student.id}`}>Note about {student.name}</label>
                    <textarea
                      id={`attendance-note-${student.id}`}
                      maxLength={1000}
                      value={noteDrafts[student.id] || ""}
                      onChange={(event) => setNoteDrafts((current) => ({
                        ...current,
                        [student.id]: event.target.value
                      }))}
                      placeholder="What should Mr. Parker know?"
                    />
                    <div className={styles.noteActions}>
                      <span>{(noteDrafts[student.id] || "").length}/1000</span>
                      <button
                        type="button"
                        disabled={noteSaving.has(student.id)}
                        onClick={() => saveNote(student.id)}
                      >
                        {noteSaving.has(student.id) ? "Saving…" : "Save note"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            </div>
          );
        })}
        {!visible.length && <p className={styles.empty}>No students match that search.</p>}
      </section>

      <div className={styles.reportBar}>
        <div>
          <strong>{counts.absent} absent · {counts.notes} notes</strong>
          <span>The email includes marked absences and every saved staff note.</span>
        </div>
        <button
          type="button"
          disabled={(!counts.absent && !counts.notes) || sending || saving.size > 0 || noteSaving.size > 0}
          onClick={sendAbsentList}
        >
          {sending ? "Sending…" : "Send report to Mr. Parker"}
        </button>
      </div>
    </main>
  );
}

function AttendanceGate({ onOpen }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/attendance/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "PIN not recognized.");
      onOpen();
    } catch (accessError) {
      setError(accessError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`${styles.shell} ${styles.gateShell}`}>
      <form className={styles.gate} onSubmit={submit}>
        <p className={styles.eyebrow}>Ashley Bands · Private staff tool</p>
        <h1>Band Camp Attendance</h1>
        <p>Use the established program PIN to open the Day 1 roster.</p>
        <label htmlFor="attendance-pin">Attendance PIN</label>
        <input
          id="attendance-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        {error && <p className={styles.gateError} role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Opening…" : "Open attendance"}</button>
        <small>Student information stays behind this access gate. Lock the page when you are finished.</small>
      </form>
    </main>
  );
}
