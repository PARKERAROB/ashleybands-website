"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./attendance.module.css";

const STATUS = {
  present: { short: "P", label: "Present" },
  tardy: { short: "T", label: "Tardy" },
  absent: { short: "A", label: "Absent" }
};

const EXCEPTION_LABELS = {
  absent: "Absent",
  late_arrival: "Late arrival",
  early_departure: "Early departure"
};

function eventDate(event) {
  if (!event) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: event.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(event.startsAt));
}

function eventTime(event) {
  if (!event) return "";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timeZone,
    hour: "numeric",
    minute: "2-digit"
  });
  return `${formatter.format(new Date(event.startsAt))}${event.endsAt ? ` to ${formatter.format(new Date(event.endsAt))}` : ""}`;
}

function shortEventLabel(event) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timeZone,
    month: "short",
    day: "numeric"
  }).format(new Date(event.startsAt));
  return `${date}: ${event.title}`;
}

function timeLabel(iso, timeZone) {
  if (!iso) return "Time not specified";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

export default function AttendanceClient() {
  const [access, setAccess] = useState("checking");
  const [students, setStudents] = useState([]);
  const [event, setEvent] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [canManageExceptions, setCanManageExceptions] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(new Set());
  const [noteSaving, setNoteSaving] = useState(new Set());
  const [openNotes, setOpenNotes] = useState(new Set());
  const [noteDrafts, setNoteDrafts] = useState({});
  const [openDepartures, setOpenDepartures] = useState(new Set());
  const [departureDrafts, setDepartureDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const loadedKey = useRef(null);

  const loadRoster = useCallback(async ({ quiet = false, occurrenceKey } = {}) => {
    try {
      const key = occurrenceKey || loadedKey.current;
      const params = key ? `?occurrence=${encodeURIComponent(key)}` : "";
      const response = await fetch(`/api/attendance${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAccess("locked");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Attendance could not be loaded.");
      const changingOccurrence = loadedKey.current !== data.event?.occurrenceKey;
      setStudents((current) => {
        if (changingOccurrence || !loadedKey.current) return data.students || [];
        const localById = new Map(current.map((student) => [student.id, student]));
        return (data.students || []).map((student) => saving.has(student.id) || noteSaving.has(student.id)
          ? localById.get(student.id) || student
          : student);
      });
      loadedKey.current = data.event?.occurrenceKey || null;
      setEvent(data.event || null);
      setOccurrences(data.occurrences || []);
      setExceptions(data.exceptions || []);
      setCanManageExceptions(Boolean(data.canManageExceptions));
      setLastSynced(new Date());
      setAccess("open");
      if (!quiet) setError("");
    } catch (loadError) {
      if (!quiet) setError(loadError.message);
    }
  }, [noteSaving, saving]);

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
    if (student.departedAt) total.departed += 1;
    return total;
  }, { present: 0, tardy: 0, absent: 0, unmarked: 0, notes: 0, departed: 0 }), [students]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.name, student.section, student.assignment, student.grade, student.note]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)));
  }, [query, students]);

  const patchStudent = async (studentId, changes) => {
    const response = await fetch("/api/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurrenceKey: event.occurrenceKey, studentId, ...changes })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "That attendance change did not save.");
    return data;
  };

  const mark = async (studentId, status) => {
    const prior = students.find((student) => student.id === studentId)?.status || null;
    setNotice("");
    setError("");
    setStudents((current) => current.map((student) => student.id === studentId
      ? { ...student, status }
      : student));
    setSaving((current) => new Set(current).add(studentId));
    try {
      await patchStudent(studentId, { status: status || "unmarked" });
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
      const data = await patchStudent(studentId, { note });
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

  const toggleDeparture = (student) => {
    setOpenDepartures((current) => {
      const next = new Set(current);
      if (next.has(student.id)) next.delete(student.id);
      else next.add(student.id);
      return next;
    });
    setDepartureDrafts((current) => Object.prototype.hasOwnProperty.call(current, student.id)
      ? current
      : { ...current, [student.id]: { time: "", note: "" } });
  };

  const saveDeparture = async (studentId) => {
    const draft = departureDrafts[studentId] || { time: "", note: "" };
    const departedTime = draft.time;
    if (!departedTime) {
      setError("Choose the actual departure time.");
      return;
    }
    setSaving((current) => new Set(current).add(studentId));
    setError("");
    setNotice("");
    try {
      const data = await patchStudent(studentId, {
        departedTime,
        ...(String(draft.note || "").trim() ? { note: draft.note } : {})
      });
      setStudents((current) => current.map((student) => student.id === studentId
        ? { ...student, departedAt: data.departedAt, note: data.note || student.note }
        : student));
      setOpenDepartures((current) => {
        const next = new Set(current);
        next.delete(studentId);
        return next;
      });
      setNotice("Actual departure time saved.");
      setLastSynced(new Date());
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(studentId);
        return next;
      });
    }
  };

  const sendReport = async () => {
    const confirmed = window.confirm(`Send Mr. Parker the report for ${event.title} on ${eventDate(event)}?`);
    if (!confirmed) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The attendance report could not be sent.");
      setNotice(`Sent the ${eventDate(event)} attendance report to Mr. Parker.`);
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
    return <AttendanceGate onOpen={() => { loadedKey.current = null; loadRoster(); }} />;
  }

  const hasReportableDetails = counts.absent || counts.tardy || counts.notes || counts.departed || exceptions.length;

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Ashley Bands · Private staff tool</p>
        <div className={styles.titleRow}>
          <div>
            <div className={styles.eventHeading}>
              <h1>{event?.title || "Attendance"}</h1>
              {event?.isPast && <span className={styles.pastLabel}>Past event</span>}
            </div>
            <p>{eventDate(event)} · {eventTime(event)}</p>
          </div>
          <button className={styles.signOut} type="button" onClick={async () => {
            await fetch("/api/attendance/access", { method: "DELETE" });
            setAccess("locked");
          }}>Lock</button>
        </div>
        <label className={styles.eventPicker}>
          <span>Attendance event</span>
          <select
            value={event?.occurrenceKey || ""}
            disabled={saving.size > 0 || noteSaving.size > 0}
            onChange={(changeEvent) => {
              setQuery("");
              setOpenNotes(new Set());
              setOpenDepartures(new Set());
              loadRoster({ occurrenceKey: changeEvent.target.value });
            }}
          >
            {occurrences.map((occurrence) => (
              <option key={occurrence.occurrenceKey} value={occurrence.occurrenceKey}>
                {shortEventLabel(occurrence)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <ExpectedExceptions
        exceptions={exceptions}
        event={event}
        students={students}
        canManage={canManageExceptions}
        onSaved={() => loadRoster({ occurrenceKey: event.occurrenceKey })}
        onError={setError}
        onNotice={setNotice}
      />

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
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
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
                      <span>Grade {student.grade}</span><span aria-hidden="true">·</span>
                      <span>{student.assignment || student.section}</span>
                      {student.provisional && <span className={styles.provisionalBadge}>Provisional</span>}
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
                      ><span aria-hidden="true">{option.short}</span></button>
                    ))}
                  </div>
                </div>
                {student.exceptions?.length > 0 && (
                  <p className={styles.studentExpected}>
                    Expected: {student.exceptions.map((item) => EXCEPTION_LABELS[item.kind]).join(", ")}
                  </p>
                )}
                <div className={styles.studentTools}>
                  <button
                    className={`${styles.noteToggle} ${student.note ? styles.hasNote : ""}`}
                    type="button"
                    aria-expanded={openNotes.has(student.id)}
                    onClick={() => toggleNote(student)}
                  >{student.note ? `Staff note: ${student.note}` : "+ Add staff note"}</button>
                  <button
                    className={`${styles.departureToggle} ${student.departedAt ? styles.hasDeparture : ""}`}
                    type="button"
                    aria-expanded={openDepartures.has(student.id)}
                    onClick={() => toggleDeparture(student)}
                  >{student.departedAt ? `Departed ${timeLabel(student.departedAt, event.timeZone)}` : "+ Record departure"}</button>
                </div>
                {openNotes.has(student.id) && (
                  <div className={styles.noteEditor}>
                    <label htmlFor={`attendance-note-${student.id}`}>Note about {student.name}</label>
                    <textarea
                      id={`attendance-note-${student.id}`}
                      maxLength={1000}
                      value={noteDrafts[student.id] || ""}
                      onChange={(changeEvent) => setNoteDrafts((current) => ({ ...current, [student.id]: changeEvent.target.value }))}
                      placeholder="What should Mr. Parker know?"
                    />
                    <div className={styles.noteActions}>
                      <span>{(noteDrafts[student.id] || "").length}/1000</span>
                      <button type="button" disabled={noteSaving.has(student.id)} onClick={() => saveNote(student.id)}>
                        {noteSaving.has(student.id) ? "Saving…" : "Save note"}
                      </button>
                    </div>
                  </div>
                )}
                {openDepartures.has(student.id) && (
                  <div className={styles.departureEditor}>
                    <label htmlFor={`departure-${student.id}`}>Actual departure time for {student.name}</label>
                    <div>
                      <input
                        id={`departure-${student.id}`}
                        type="time"
                        value={departureDrafts[student.id]?.time || ""}
                        onChange={(changeEvent) => setDepartureDrafts((current) => ({
                          ...current,
                          [student.id]: { ...current[student.id], time: changeEvent.target.value }
                        }))}
                      />
                      <button type="button" disabled={saving.has(student.id)} onClick={() => saveDeparture(student.id)}>
                        {saving.has(student.id) ? "Saving…" : "Save actual time"}
                      </button>
                    </div>
                    <label htmlFor={`departure-note-${student.id}`}>Optional note</label>
                    <input
                      id={`departure-note-${student.id}`}
                      type="text"
                      maxLength={1000}
                      placeholder="Reason or context for Mr. Parker"
                      value={departureDrafts[student.id]?.note || ""}
                      onChange={(changeEvent) => setDepartureDrafts((current) => ({
                        ...current,
                        [student.id]: { ...current[student.id], note: changeEvent.target.value }
                      }))}
                    />
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
          <strong>{counts.absent} absent · {counts.tardy} tardy · {counts.departed} departed</strong>
          <span>The report includes saved notes, approved plans, and actual departures.</span>
        </div>
        <button
          type="button"
          disabled={!hasReportableDetails || sending || saving.size > 0 || noteSaving.size > 0}
          onClick={sendReport}
        >{sending ? "Sending…" : "Send selected report"}</button>
      </div>
    </main>
  );
}

function ExpectedExceptions({ exceptions, event, students, canManage, onSaved, onError, onNotice }) {
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState("absent");
  const [expectedTime, setExpectedTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (submitEvent) => {
    submitEvent.preventDefault();
    setBusy(true);
    onError("");
    onNotice("");
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceKey: event.occurrenceKey,
          studentId,
          exception: { kind, expectedTime, note }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The approved exception did not save.");
      setStudentId("");
      setExpectedTime("");
      setNote("");
      onNotice("Approved exception saved.");
      onSaved();
    } catch (saveError) {
      onError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.expected} aria-labelledby="expected-heading">
      <div className={styles.expectedHeading}>
        <div>
          <p className={styles.eyebrow}>Approved plans</p>
          <h2 id="expected-heading">Expected for this event</h2>
        </div>
        <strong>{exceptions.length}</strong>
      </div>
      {exceptions.length ? (
        <ul>
          {exceptions.map((item) => (
            <li key={item.id}>
              <strong>{item.studentName}</strong>
              <span>{EXCEPTION_LABELS[item.kind]}{item.expected_at ? ` at ${timeLabel(item.expected_at, event.timeZone)}` : ""}</span>
              {item.note && <small>{item.note}</small>}
            </li>
          ))}
        </ul>
      ) : <p className={styles.noExpected}>No approved exceptions are recorded.</p>}
      {canManage && (
        <details className={styles.exceptionManager}>
          <summary>Add or update an approved exception</summary>
          <form onSubmit={save}>
            <label>Student
              <select required value={studentId} onChange={(changeEvent) => setStudentId(changeEvent.target.value)}>
                <option value="">Choose a student</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
              </select>
            </label>
            <label>Plan
              <select value={kind} onChange={(changeEvent) => setKind(changeEvent.target.value)}>
                {Object.entries(EXCEPTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Expected time
              <input type="time" value={expectedTime} onChange={(changeEvent) => setExpectedTime(changeEvent.target.value)} />
            </label>
            <label>Short reason or note
              <input maxLength={1000} value={note} onChange={(changeEvent) => setNote(changeEvent.target.value)} />
            </label>
            <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save approved plan"}</button>
          </form>
        </details>
      )}
    </section>
  );
}

function AttendanceGate({ onOpen }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (submitEvent) => {
    submitEvent.preventDefault();
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
        <h1>Marching Band Attendance</h1>
        <p>Use the established program PIN to open the shared event roster.</p>
        <label htmlFor="attendance-pin">Attendance PIN</label>
        <input
          id="attendance-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          autoFocus
          value={pin}
          onChange={(changeEvent) => setPin(changeEvent.target.value)}
        />
        {error && <p className={styles.gateError} role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Opening…" : "Open attendance"}</button>
        <small>Student information stays behind this access gate. Lock the page when you are finished.</small>
      </form>
    </main>
  );
}
