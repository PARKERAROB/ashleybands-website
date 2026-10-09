"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttendanceGate } from "../AttendanceClient";
import { BUS_LEGS, OTHER_RIDES, busRides, rideLabel, summarizeLeg } from "@/lib/attendanceBus.mjs";
import base from "../attendance.module.css";
import styles from "./bus.module.css";

const EXCEPTION_LABELS = {
  absent: "Approved absence",
  late_arrival: "Approved late arrival",
  early_departure: "Approved early departure"
};

function eventDate(event) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: event.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(event.startsAt));
}

function setUrlParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(null, "", url);
}

export default function BusClient({ initialOccurrenceKey = "", initialLeg = "to_venue", requestedBuses = "" }) {
  const [access, setAccess] = useState("checking");
  const [event, setEvent] = useState(null);
  const [students, setStudents] = useState([]);
  const [checks, setChecks] = useState([]);
  const [leg, setLeg] = useState(Object.hasOwn(BUS_LEGS, initialLeg) ? initialLeg : "to_venue");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(new Set());
  const [error, setError] = useState("");
  const [lastSynced, setLastSynced] = useState(null);
  const savingRef = useRef(saving);
  useEffect(() => { savingRef.current = saving; }, [saving]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    try {
      const params = new URLSearchParams({ bus: "1" });
      if (initialOccurrenceKey) params.set("occurrence", initialOccurrenceKey);
      const response = await fetch(`/api/attendance?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAccess("locked");
        return;
      }
      if (!response.ok) throw new Error(data.error || "The bus check could not be loaded.");
      setEvent(data.event || null);
      setStudents(data.students || []);
      // Keep marks that are still saving so a poll cannot undo a tap.
      setChecks((current) => [
        ...(data.busChecks || []).filter((check) => !savingRef.current.has(`${check.studentId}:${check.leg}`)),
        ...current.filter((check) => savingRef.current.has(`${check.studentId}:${check.leg}`))
      ]);
      setLastSynced(new Date());
      setAccess("open");
      if (!quiet) setError("");
    } catch (loadError) {
      if (!quiet) setError(loadError.message);
      setAccess((current) => (current === "checking" ? "open" : current));
    }
  }, [initialOccurrenceKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    const poll = window.setInterval(() => load({ quiet: true }), 15000);
    return () => { window.clearTimeout(timer); window.clearInterval(poll); };
  }, [load]);

  const rides = useMemo(() => [...busRides(requestedBuses, checks), ...Object.keys(OTHER_RIDES)], [requestedBuses, checks]);
  const { rideByStudent, counts, missing } = useMemo(() => summarizeLeg(students, checks, leg), [students, checks, leg]);
  const outbound = useMemo(() => summarizeLeg(students, checks, "to_venue").rideByStudent, [students, checks]);
  const writable = Boolean(event?.rosterCompleteness === "locked");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      const ride = rideByStudent.get(student.id);
      if (filter === "missing" && ride) return false;
      if (filter !== "all" && filter !== "missing" && ride !== filter) return false;
      return !needle || [student.name, student.section, student.assignment]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [students, rideByStudent, filter, query]);

  const mark = async (studentId, ride) => {
    const key = `${studentId}:${leg}`;
    const previous = checks;
    setSaving((current) => new Set(current).add(key));
    setChecks((current) => [
      ...current.filter((check) => !(check.studentId === studentId && check.leg === leg)),
      ...(ride ? [{ studentId, leg, ride }] : [])
    ]);
    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceKey: event.occurrenceKey, studentId, bus: { leg, ride } })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) setAccess("locked");
      if (!response.ok) throw new Error(data.error || "That mark did not save. Try again.");
      setError("");
    } catch (saveError) {
      setChecks(previous);
      setError(saveError.message);
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const chooseLeg = (value) => {
    setLeg(value);
    setFilter("all");
    setUrlParam("leg", value);
  };

  if (access === "checking") {
    return <main className={base.shell}><p className={base.loading}>Opening bus check…</p></main>;
  }
  if (access === "locked") {
    return <AttendanceGate title="Bus Check" onOpen={() => { setAccess("checking"); load(); }} />;
  }
  if (!event) {
    return (
      <main className={base.shell}>
        <div className={base.loadFailure} role="alert">
          <h1>Bus check</h1>
          <p>{error || "No event is open for a bus check."}</p>
        </div>
      </main>
    );
  }

  const chip = (value, label, count, tone = "") => (
    <button
      key={value}
      type="button"
      className={`${styles.chip} ${tone} ${filter === value ? styles.chipActive : ""}`}
      aria-pressed={filter === value}
      onClick={() => setFilter(filter === value ? "all" : value)}
    ><strong>{count}</strong> {label}</button>
  );

  return (
    <main className={base.shell}>
      <header className={base.hero}>
        <p className={base.eyebrow}>Ashley Bands · Chaperone bus check</p>
        <div className={base.titleRow}>
          <div>
            <h1>{event.title}</h1>
            <p>{eventDate(event)} · {students.length} students</p>
          </div>
          <button className={base.signOut} type="button" onClick={async () => {
            await fetch("/api/attendance/access", { method: "DELETE" });
            setAccess("locked");
          }}>Lock</button>
        </div>
        <div className={styles.legs} role="group" aria-label="Trip leg">
          {Object.entries(BUS_LEGS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={leg === value}
              className={leg === value ? styles.legActive : ""}
              onClick={() => chooseLeg(value)}
            >{label}</button>
          ))}
        </div>
      </header>

      {!writable && (
        <div className={base.error} role="alert">
          This event is not open yet. Ask Mr. Parker to open it on the attendance sheet.
        </div>
      )}

      <section className={base.toolbar} aria-label="Bus headcount">
        <div className={styles.chips}>
          {chip("missing", "Missing", missing.length, missing.length ? styles.chipMissing : styles.chipDone)}
          {rides.map((ride) => chip(ride, rideLabel(ride), counts[ride] || 0))}
        </div>
        <div className={base.syncLine} aria-live="polite">
          {saving.size ? `Saving ${saving.size}…` : lastSynced ? "Shared list is up to date" : "Loading…"}
        </div>
      </section>

      {error && <div className={base.error} role="alert">{error}</div>}

      <section className={styles.missing} aria-label="Missing students">
        {missing.length === 0
          ? <p className={styles.allIn}>Everyone is accounted for on this leg.</p>
          : <p><strong>Missing ({missing.length}):</strong> {missing.length <= 12
            ? missing.map((student) => student.name).join(", ")
            : "tap Missing above to list them."}</p>}
      </section>

      <div className={styles.search}>
        <label className={base.search}>
          <span className={base.srOnly}>Find a student</span>
          <input
            type="search"
            inputMode="search"
            placeholder="Find name or section"
            value={query}
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
          />
        </label>
      </div>

      <div className={base.listHeader}>
        <span>{visible.length} of {students.length} students</span>
        <span>Tap again to clear</span>
      </div>

      <section className={base.roster} aria-label="Bus roster">
        {visible.map((student, index) => {
          const ride = rideByStudent.get(student.id);
          const busy = saving.has(`${student.id}:${leg}`);
          const wentOn = leg === "return" ? outbound.get(student.id) : null;
          const flags = [
            student.status === "absent" ? "Marked absent today" : "",
            ...(student.exceptions || []).map((item) => EXCEPTION_LABELS[item.kind])
          ].filter(Boolean);
          return (
            <div key={student.id}>
              {(index === 0 || visible[index - 1].section !== student.section) && (
                <h2 className={base.sectionTitle}>{student.section}</h2>
              )}
              <article className={`${base.student} ${ride ? styles.marked : ""}`}>
                <div className={base.identity}>
                  <h3>{student.name}</h3>
                  <p>
                    <span>{student.assignment || student.section}</span>
                    {wentOn && <><span aria-hidden="true">·</span><span>Went on {rideLabel(wentOn)}</span></>}
                  </p>
                </div>
                {flags.length > 0 && <p className={base.studentExpected}>{flags.join(", ")}</p>}
                <div className={styles.rides} role="group" aria-label={`${student.name}: ${BUS_LEGS[leg]}`}>
                  {rides.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.ride} ${ride === value ? styles.rideSelected : ""}`}
                      aria-pressed={ride === value}
                      disabled={!writable || busy}
                      onClick={() => mark(student.id, ride === value ? null : value)}
                    >{rideLabel(value)}</button>
                  ))}
                </div>
              </article>
            </div>
          );
        })}
      </section>
    </main>
  );
}
