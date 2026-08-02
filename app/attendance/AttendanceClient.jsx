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
    return total;
  }, { present: 0, tardy: 0, absent: 0, unmarked: 0 }), [students]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.name, student.section, student.assignment, student.grade]
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
        body: JSON.stringify({ studentId, status })
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

  const sendAbsentList = async () => {
    const absentCount = counts.absent;
    if (!absentCount) return;
    const confirmed = window.confirm(
      `Send Mr. Parker the current list of ${absentCount} student${absentCount === 1 ? "" : "s"} marked absent?`
    );
    if (!confirmed) return;

    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance/report", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The absent list could not be sent.");
      setNotice(`Sent Mr. Parker the list of ${data.count} marked absent.`);
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
        <span>Tap P, T, or A</span>
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
                      onClick={() => mark(student.id, value)}
                    >
                      <span aria-hidden="true">{option.short}</span>
                    </button>
                  ))}
                </div>
              </article>
            </div>
          );
        })}
        {!visible.length && <p className={styles.empty}>No students match that search.</p>}
      </section>

      <div className={styles.reportBar}>
        <div>
          <strong>{counts.absent} marked absent</strong>
          <span>The email includes everyone currently marked A.</span>
        </div>
        <button
          type="button"
          disabled={!counts.absent || sending || saving.size > 0}
          onClick={sendAbsentList}
        >
          {sending ? "Sending…" : "Send absent list to Mr. Parker"}
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
