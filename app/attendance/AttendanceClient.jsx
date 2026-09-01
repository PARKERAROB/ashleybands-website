"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupAttendanceOccurrencesByWeek } from "@/lib/attendanceEvents.mjs";
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

const STAFF_STATUS = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  left_early: "Left early"
};

const STAFF_ROLE_LABELS = {
  director: "Director",
  sponsor_lead: "Sponsor lead"
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
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(event.startsAt));
  return `${date} · ${event.title}`;
}

function weekLabel(weekStart) {
  if (!weekStart) return "";
  return `Week of ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${weekStart}T12:00:00.000Z`))}`;
}

function timeLabel(iso, timeZone) {
  if (!iso) return "Time not specified";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function timeInputValue(iso, timeZone) {
  if (!iso) return "";
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export default function AttendanceClient({ initialOccurrenceKey = "", initialStudentId = "" }) {
  const [access, setAccess] = useState("checking");
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [event, setEvent] = useState(null);
  const [occurrences, setOccurrences] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [canWriteAttendance, setCanWriteAttendance] = useState(false);
  const [canManageExceptions, setCanManageExceptions] = useState(false);
  const [canManageStaff, setCanManageStaff] = useState(false);
  const [canPrepare, setCanPrepare] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [canSendReport, setCanSendReport] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(new Set());
  const [noteSaving, setNoteSaving] = useState(new Set());
  const [staffSaving, setStaffSaving] = useState(new Set());
  const [openNotes, setOpenNotes] = useState(new Set());
  const [noteDrafts, setNoteDrafts] = useState({});
  const [openDepartures, setOpenDepartures] = useState(new Set());
  const [departureDrafts, setDepartureDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [highlightedStudentId, setHighlightedStudentId] = useState("");
  const [lastSynced, setLastSynced] = useState(null);
  const loadedKey = useRef(null);
  const savingRef = useRef(saving);
  const noteSavingRef = useRef(noteSaving);

  useEffect(() => { savingRef.current = saving; }, [saving]);
  useEffect(() => { noteSavingRef.current = noteSaving; }, [noteSaving]);

  const loadRoster = useCallback(async ({ quiet = false, occurrenceKey } = {}) => {
    try {
      const key = occurrenceKey || loadedKey.current;
      const params = key ? `?occurrence=${encodeURIComponent(key)}` : "";
      const response = await fetch(`/api/attendance${params}`, {
        cache: "no-store"
      });
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
        return (data.students || []).map((student) => savingRef.current.has(student.id) || noteSavingRef.current.has(student.id)
          ? localById.get(student.id) || student
          : student);
      });
      setStaff(data.staff || []);
      loadedKey.current = data.event?.occurrenceKey || null;
      setEvent(data.event || null);
      setOccurrences(data.occurrences || []);
      setExceptions(data.exceptions || []);
      setCanWriteAttendance(Boolean(data.canWriteAttendance));
      setCanManageExceptions(Boolean(data.canManageExceptions));
      setCanManageStaff(Boolean(data.canManageStaff));
      setCanPrepare(Boolean(data.canPrepare));
      setCanComplete(Boolean(data.canComplete));
      setCanSendReport(Boolean(data.canSendReport));
      setLastSynced(new Date());
      setAccess("open");
      if (!quiet) setError("");
      const requestedStudentId = new URLSearchParams(window.location.search).get("student") || initialStudentId;
      const requestedStudent = (data.students || []).find((student) => student.id === requestedStudentId);
      if (requestedStudentId && requestedStudent) {
        setHighlightedStudentId(requestedStudentId);
        if (!quiet) setNotice(`Showing ${requestedStudent.name} in this event roster.`);
        if (!quiet) {
          window.requestAnimationFrame(() => {
            const target = document.querySelector(`[data-student-id="${CSS.escape(requestedStudentId)}"]`);
            target?.scrollIntoView({ block: "center", behavior: "smooth" });
            target?.focus({ preventScroll: true });
          });
        }
      } else if (requestedStudentId) {
        setHighlightedStudentId("");
        if (!quiet) setNotice("That student is not expected for this attendance session.");
      } else {
        setHighlightedStudentId("");
      }
    } catch (loadError) {
      if (!quiet) setError(loadError.message);
    }
  }, [initialStudentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRoster({ occurrenceKey: initialOccurrenceKey || undefined }), 0);
    return () => window.clearTimeout(timer);
  }, [initialOccurrenceKey, loadRoster]);

  useEffect(() => {
    const restoreOccurrence = () => {
      const occurrenceKey = new URLSearchParams(window.location.search).get("occurrence") || undefined;
      loadRoster({ occurrenceKey });
    };
    window.addEventListener("popstate", restoreOccurrence);
    return () => window.removeEventListener("popstate", restoreOccurrence);
  }, [loadRoster]);

  useEffect(() => {
    const timer = window.setInterval(() => loadRoster({ quiet: true }), 15000);
    return () => window.clearInterval(timer);
  }, [loadRoster]);

  const counts = useMemo(() => students.reduce((total, student) => {
    total[student.status || "unmarked"] += 1;
    if (String(student.note || "").trim()) total.notes += 1;
    if (student.departedAt) total.departed += 1;
    return total;
  }, { present: 0, tardy: 0, absent: 0, unmarked: 0, notes: 0, departed: 0 }), [students]);

  const occurrenceGroups = useMemo(
    () => groupAttendanceOccurrencesByWeek(occurrences),
    [occurrences]
  );
  const occurrenceIndex = occurrences.findIndex((item) => item.occurrenceKey === event?.occurrenceKey);

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

  const selectOccurrence = (occurrenceKey) => {
    setQuery("");
    setOpenNotes(new Set());
    setOpenDepartures(new Set());
    const params = new URLSearchParams(window.location.search);
    params.set("occurrence", occurrenceKey);
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);
    loadRoster({ occurrenceKey });
  };

  const prepareEvent = async () => {
    const mappedGroups = Array.from(new Set([
      ...(Array.isArray(event.groups) ? event.groups : []),
      ...students.flatMap((student) => Array.isArray(student.groups) ? student.groups : [])
    ].filter(Boolean)));
    const expectedCount = event.expectedCount !== null && event.expectedCount !== undefined
      && Number.isFinite(Number(event.expectedCount))
      ? Number(event.expectedCount)
      : students.length || null;
    const confirmationDetails = [
      mappedGroups.length ? `Mapped groups: ${mappedGroups.join(" + ")}.` : "",
      expectedCount !== null ? `Expected students: ${expectedCount}.` : ""
    ].filter(Boolean).join("\n");
    if (!window.confirm(`Prepare attendance for ${event.title}?\n\n${confirmationDetails || "This saves the expected roster for this date."}\n\nThe saved roster stays with this event even if memberships change later.`)) return;
    setPreparing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey, prepare: true })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "This event could not be prepared.");
      await loadRoster({ occurrenceKey: event.occurrenceKey });
      setNotice(`Attendance is ready with ${data.rosterCount || 0} expected students.`);
    } catch (prepareError) {
      setError(prepareError.message);
    } finally {
      setPreparing(false);
    }
  };

  const completeEvent = async () => {
    if (!window.confirm(`Complete attendance for ${event.title}? The roster will become read-only.`)) return;
    setCompleting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey, complete: true })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "This attendance session could not be completed.");
      await loadRoster({ occurrenceKey: event.occurrenceKey });
      setNotice("Attendance session completed.");
    } catch (completeError) {
      setError(completeError.message);
    } finally {
      setCompleting(false);
    }
  };

  const saveStaffAttendance = async (member, changes) => {
    const savingKey = member?.key || `new:${changes.displayName || "staff"}`;
    setStaffSaving((current) => new Set(current).add(savingKey));
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceKey: event.occurrenceKey,
          staffAttendance: {
            recordId: member?.id,
            staffId: member?.staffId,
            displayName: member?.name || changes.displayName,
            ...changes
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "That staff attendance change did not save.");
      setStaff((current) => {
        const matchIndex = current.findIndex((item) => item.key === data.key);
        if (matchIndex < 0) return [...current, data].sort((a, b) => a.name.localeCompare(b.name));
        return current.map((item, index) => index === matchIndex ? data : item);
      });
      setLastSynced(new Date());
      setNotice(member ? `${data.name}'s staff attendance saved.` : `${data.name} added to this session.`);
      return data;
    } catch (saveError) {
      setError(saveError.message);
      throw saveError;
    } finally {
      setStaffSaving((current) => {
        const next = new Set(current);
        next.delete(savingKey);
        return next;
      });
    }
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
    return <AttendanceGate onOpen={() => {
      loadedKey.current = null;
      setAccess("checking");
      loadRoster({ occurrenceKey: initialOccurrenceKey || undefined });
    }} />;
  }
  if (!event) {
    return (
      <main className={styles.shell}>
        <div className={styles.loadFailure} role={error ? "alert" : "status"}>
          <h1>Attendance</h1>
          <p>{error || "Opening attendance…"}</p>
          {error && <button type="button" onClick={() => {
            window.history.replaceState(null, "", window.location.pathname);
            loadedKey.current = null;
            setError("");
            loadRoster({ occurrenceKey: undefined });
          }}>Open current session</button>}
        </div>
      </main>
    );
  }

  const staffReportableCount = staff.filter((member) => member.status
    || member.arrivedAt
    || member.departedAt
    || member.roleAssignment
    || member.workNotes).length;
  const hasReportableDetails = counts.absent || counts.tardy || counts.notes || counts.departed
    || exceptions.length || staffReportableCount;
  const historicalRecordsOnly = event.rosterCompleteness === "observed_only";
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
        <div className={styles.sessionNavigator} aria-label="Move among attendance sessions">
          <button
            type="button"
            disabled={occurrenceIndex <= 0 || saving.size > 0 || noteSaving.size > 0 || staffSaving.size > 0}
            onClick={() => selectOccurrence(occurrences[occurrenceIndex - 1].occurrenceKey)}
          >← Previous</button>
          <div>
            <strong>{weekLabel(occurrenceGroups.find((group) =>
              group.occurrences.some((item) => item.occurrenceKey === event?.occurrenceKey))?.weekStart)}</strong>
            <span>{occurrenceIndex + 1} of {occurrences.length} sessions</span>
          </div>
          <button
            type="button"
            disabled={occurrenceIndex < 0 || occurrenceIndex >= occurrences.length - 1
              || saving.size > 0 || noteSaving.size > 0 || staffSaving.size > 0}
            onClick={() => selectOccurrence(occurrences[occurrenceIndex + 1].occurrenceKey)}
          >Next →</button>
        </div>
        <label className={styles.eventPicker}>
          <span>Choose any date</span>
          <select
            value={event?.occurrenceKey || ""}
            disabled={saving.size > 0 || noteSaving.size > 0 || staffSaving.size > 0}
            onChange={(changeEvent) => selectOccurrence(changeEvent.target.value)}
          >
            {occurrenceGroups.map((group) => (
              <optgroup key={group.weekStart} label={weekLabel(group.weekStart)}>
                {group.occurrences.map((occurrence) => (
                  <option key={occurrence.occurrenceKey} value={occurrence.occurrenceKey}>
                    {shortEventLabel(occurrence)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </header>

      <RosterState
        event={event}
        canPrepare={canPrepare}
        preparing={preparing}
        onPrepare={prepareEvent}
      />

      <section className={styles.toolbar} aria-label="Attendance summary">
        <div className={styles.counts}>
          {historicalRecordsOnly
            ? <span><strong>{students.length}</strong> Saved records</span>
            : <span><strong>{counts.unmarked}</strong> Unmarked</span>}
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
          {saving.size || staffSaving.size
            ? `Saving ${saving.size + staffSaving.size}…`
            : lastSynced ? "Shared list is up to date" : "Loading shared list…"}
        </div>
      </section>

      {(error || notice) && (
        <div className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>
          {error || notice}
        </div>
      )}

      <div className={styles.listHeader}>
        <span>{visible.length} of {students.length} {historicalRecordsOnly ? "saved records" : "students"}</span>
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
              <article
                className={`${styles.student} ${student.provisional ? styles.provisionalStudent : ""} ${student.id === highlightedStudentId ? styles.highlightedStudent : ""}`}
                data-student-id={student.id}
                tabIndex={-1}
              >
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
                        disabled={!canWriteAttendance || saving.has(student.id)}
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
                    disabled={!canWriteAttendance}
                    onClick={() => toggleNote(student)}
                  >{student.note ? `Staff note: ${student.note}` : "+ Add staff note"}</button>
                  <button
                    className={`${styles.departureToggle} ${student.departedAt ? styles.hasDeparture : ""}`}
                    type="button"
                    aria-expanded={openDepartures.has(student.id)}
                    disabled={!canWriteAttendance}
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

      {event.lifecycleState === "open" && event.rosterCompleteness === "locked" && (
        <section className={styles.completionBar}>
          <div>
            <strong>{canComplete ? "Every expected student is marked." : `${counts.unmarked} students remain unmarked.`}</strong>
            <span>Complete the session when the roster is finished.</span>
          </div>
          <button type="button" disabled={!canComplete || completing} onClick={completeEvent}>
            {completing ? "Completing…" : "Complete session"}
          </button>
        </section>
      )}

      <ExpectedExceptions
        key={`exceptions:${event?.occurrenceKey}`}
        exceptions={exceptions}
        event={event}
        students={students}
        canManage={canManageExceptions}
        onSaved={() => loadRoster({ occurrenceKey: event.occurrenceKey })}
        onError={setError}
        onNotice={setNotice}
      />

      {(canManageStaff || staff.length > 0) && <StaffAttendance
        key={`staff:${event?.occurrenceKey}`}
        event={event}
        staff={staff}
        saving={staffSaving}
        onSave={saveStaffAttendance}
        onError={setError}
        canEdit={canManageStaff}
      />}

      {canSendReport && event.lifecycleState === "completed" ? <div className={styles.reportBar}>
        <div>
          <strong>{counts.absent} absent · {counts.tardy} tardy · {staffReportableCount} staff entries</strong>
          <span>The report includes saved student and staff details for this session.</span>
        </div>
        <button
          type="button"
          disabled={!hasReportableDetails || sending || saving.size > 0 || noteSaving.size > 0 || staffSaving.size > 0}
          onClick={sendReport}
        >{sending ? "Sending…" : "Send selected report"}</button>
      </div> : null}
    </main>
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
        <p className={styles.eyebrow}>Ashley Bands · Private leadership tool</p>
        <h1>Program Attendance</h1>
        <p>Use the established attendance PIN to open the shared event roster.</p>
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

function RosterState({ event, canPrepare, preparing, onPrepare }) {
  if (event.rosterCompleteness === "locked") return null;
  const observedOnly = event.rosterCompleteness === "observed_only";
  const reconstructing = event.rosterCompleteness === "reconstructing";
  return (
    <section className={`${styles.rosterState} ${observedOnly || reconstructing ? styles.rosterStateHistorical : ""}`} role="status">
      <div>
        <strong>{reconstructing ? "Expected roster is being rebuilt" : observedOnly ? "Saved records only" : "Expected roster not prepared"}</strong>
        <p>{reconstructing
          ? "Finish and certify the expected roster in the Attendance workspace before marking this session."
          : observedOnly
          ? "The expected roster was not preserved for this historical event. Saved marks remain available, but missing students and completion percentages are unknown."
          : "Prepare this event once to save its expected students. That roster stays attached to this date even if memberships change later."}</p>
      </div>
      {canPrepare && (
        <button type="button" disabled={preparing} onClick={onPrepare}>
          {preparing ? "Preparing…" : "Prepare attendance"}
        </button>
      )}
    </section>
  );
}

function staffDraft(member, event) {
  return {
    arrivedTime: timeInputValue(member.arrivedAt, event.timeZone),
    departedTime: timeInputValue(member.departedAt, event.timeZone),
    roleAssignment: member.roleAssignment || "",
    workNotes: member.workNotes || ""
  };
}

function StaffAttendance({ event, staff, saving, onSave, onError, canEdit }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries(
    staff.map((member) => [member.key, staffDraft(member, event)])));
  const [newName, setNewName] = useState("");
  const [newAssignment, setNewAssignment] = useState("");
  const [adding, setAdding] = useState(false);

  const updateDraft = (memberKey, changes) => {
    setDrafts((current) => ({
      ...current,
      [memberKey]: { ...current[memberKey], ...changes }
    }));
  };

  const saveDetails = async (member) => {
    try {
      const saved = await onSave(member, drafts[member.key] || staffDraft(member, event));
      setDrafts((current) => ({ ...current, [saved.key]: staffDraft(saved, event) }));
    } catch {
      // The parent keeps the user-facing error in one consistent place.
    }
  };

  const addStaff = async (submitEvent) => {
    submitEvent.preventDefault();
    setAdding(true);
    onError("");
    try {
      const saved = await onSave(null, {
        displayName: newName,
        roleAssignment: newAssignment
      });
      setDrafts((current) => ({ ...current, [saved.key]: staffDraft(saved, event) }));
      setNewName("");
      setNewAssignment("");
    } catch {
      // The parent keeps the user-facing error in one consistent place.
    } finally {
      setAdding(false);
    }
  };

  const markedCount = staff.filter((member) => member.status).length;

  return (
    <details className={styles.staffSection} aria-labelledby="staff-attendance-heading">
      <summary className={styles.compactSummary}>
        <span><small>Same session · separate records</small><strong id="staff-attendance-heading">Staff attendance</strong></span>
        <strong>{markedCount}/{staff.length}</strong>
      </summary>
      <div className={styles.collapsibleBody}>
      <p className={styles.sectionIntro}>{canEdit
        ? "Record each person’s status, times, assignment, and short work notes for this date."
        : "Saved staff records for this completed session."}</p>

      <div className={styles.staffList}>
        {staff.map((member) => {
          const draft = drafts[member.key] || staffDraft(member, event);
          const busy = saving.has(member.key);
          return (
            <article className={styles.staffCard} key={member.key}>
              <div className={styles.staffIdentity}>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.roleAssignment
                    || STAFF_ROLE_LABELS[member.directoryRole]
                    || "Session staff"}</p>
                </div>
                <span>{member.status ? STAFF_STATUS[member.status] : "Unmarked"}</span>
              </div>
              <div className={styles.staffStatusGroup} aria-label={`Staff attendance for ${member.name}`}>
                {Object.entries(STAFF_STATUS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.staffStatusButton} ${styles[value]} ${member.status === value ? styles.selected : ""}`}
                    aria-pressed={member.status === value}
                    disabled={busy || !canEdit}
                    onClick={async () => {
                      try {
                        await onSave(member, { status: member.status === value ? "unmarked" : value });
                      } catch {
                        // The parent keeps the user-facing error in one consistent place.
                      }
                    }}
                  >{label}</button>
                ))}
              </div>
              <div className={styles.staffDetails}>
                <label>Arrival time
                  <input
                    type="time"
                    disabled={!canEdit}
                    value={draft.arrivedTime}
                    onChange={(changeEvent) => updateDraft(member.key, { arrivedTime: changeEvent.target.value })}
                  />
                </label>
                <label>Departure time
                  <input
                    type="time"
                    disabled={!canEdit}
                    value={draft.departedTime}
                    onChange={(changeEvent) => updateDraft(member.key, { departedTime: changeEvent.target.value })}
                  />
                </label>
                <label className={styles.staffAssignment}>Role or assignment
                  <input
                    type="text"
                    disabled={!canEdit}
                    maxLength={160}
                    placeholder="Director, props, front ensemble…"
                    value={draft.roleAssignment}
                    onChange={(changeEvent) => updateDraft(member.key, { roleAssignment: changeEvent.target.value })}
                  />
                </label>
                <label className={styles.staffNotes}>Short work notes
                  <textarea
                    disabled={!canEdit}
                    maxLength={500}
                    placeholder="What did this person cover or complete?"
                    value={draft.workNotes}
                    onChange={(changeEvent) => updateDraft(member.key, { workNotes: changeEvent.target.value })}
                  />
                </label>
              </div>
              {canEdit ? <button
                className={styles.staffSave}
                type="button"
                disabled={busy}
                onClick={() => saveDetails(member)}
              >{busy ? "Saving…" : "Save staff details"}</button> : null}
            </article>
          );
        })}
      </div>

      {canEdit ? <details className={styles.addStaff}>
        <summary>Add staff for this session</summary>
        <form onSubmit={addStaff}>
          <label>Name
            <input
              required
              maxLength={120}
              value={newName}
              onChange={(changeEvent) => setNewName(changeEvent.target.value)}
            />
          </label>
          <label>Role or assignment
            <input
              maxLength={160}
              placeholder="Optional"
              value={newAssignment}
              onChange={(changeEvent) => setNewAssignment(changeEvent.target.value)}
            />
          </label>
          <button type="submit" disabled={adding}>{adding ? "Adding…" : "Add to this session"}</button>
        </form>
      </details> : null}
      </div>
    </details>
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
    <details className={styles.expected} aria-labelledby="expected-heading">
      <summary className={styles.compactSummary}>
        <span><small>Approved plans</small><strong id="expected-heading">Expected exceptions</strong></span>
        <strong>{exceptions.length}</strong>
      </summary>
      <div className={styles.collapsibleBody}>
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
      </div>
    </details>
  );
}
