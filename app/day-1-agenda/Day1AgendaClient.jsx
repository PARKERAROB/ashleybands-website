"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./day-1-agenda.module.css";

export default function Day1AgendaClient() {
  const [access, setAccess] = useState("checking");
  const [agenda, setAgenda] = useState(null);
  const [error, setError] = useState("");

  const loadAgenda = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/day-1-agenda", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setAccess("locked");
        setAgenda(null);
        return;
      }
      if (!response.ok) throw new Error(data.error || "The agenda could not be opened.");
      setAgenda(data);
      setAccess("open");
    } catch (loadError) {
      setError(loadError.message);
      setAccess("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadAgenda, 0);
    return () => window.clearTimeout(timer);
  }, [loadAgenda]);

  if (access === "checking") {
    return <main className={styles.shell}><p className={styles.loading}>Opening Day 1 agenda…</p></main>;
  }

  if (access === "locked") {
    return <AgendaGate onOpen={loadAgenda} />;
  }

  if (access === "error") {
    return (
      <main className={styles.shell}>
        <div className={styles.loadError} role="alert">
          <strong>The agenda did not open.</strong>
          <span>{error}</span>
          <button type="button" onClick={loadAgenda}>Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.context}>Ashley Bands · Private conductor view</p>
          <div className={styles.titleRow}>
            <div>
              <h1>{agenda.title}</h1>
              <p>{agenda.date} · {agenda.window}</p>
            </div>
            <button className={styles.lockButton} type="button" onClick={async () => {
              await fetch("/api/attendance/access", { method: "DELETE" });
              setAgenda(null);
              setAccess("locked");
            }}>Lock</button>
          </div>
          <div className={styles.status}>{agenda.status}</div>
        </div>
      </header>

      <nav className={styles.sequence} aria-label="Agenda sequence">
        <ol>
          {agenda.sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#agenda-${index + 1}`} aria-label={`Go to ${index + 1}: ${section.title}`}>
                {index + 1}
              </a>
            </li>
          ))}
        </ol>
        <span>Baseline → Unit 1</span>
      </nav>

      <div className={styles.agenda}>
        <p className={styles.orientation}>The internal split is flexible. Keep the full Baseline + Unit 1 block inside 7:00–7:50.</p>
        <ol className={styles.sections}>
          {agenda.sections.map((section, index) => (
            <li className={styles.section} id={`agenda-${index + 1}`} key={section.title}>
              <div className={styles.sectionNumber} aria-hidden="true">{index + 1}</div>
              <div className={styles.sectionBody}>
                <h2>{section.title}</h2>
                <p className={styles.cue}>{section.cue}</p>
                <details className={styles.details} open={index === 0}>
                  <summary>Speaking cues</summary>
                  <ul>
                    {section.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                  {section.introductions && (
                    <div className={styles.introductions}>
                      <h3>{section.introductionLabel}</h3>
                      <ol>
                        {section.introductions.map((name) => <li key={name}>{name}</li>)}
                      </ol>
                    </div>
                  )}
                  {section.note && <p className={styles.note}>{section.note}</p>}
                </details>
              </div>
            </li>
          ))}
        </ol>
        <footer className={styles.sourceNote}>
          Execution view projected August 1, 2026 from the private Regiment OS working source. The source remains a review draft, not locked.
        </footer>
      </div>
    </main>
  );
}

function AgendaGate({ onOpen }) {
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
      await onOpen();
    } catch (accessError) {
      setError(accessError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`${styles.shell} ${styles.gateShell}`}>
      <form className={styles.gate} onSubmit={submit}>
        <p className={styles.context}>Ashley Bands · Private conductor view</p>
        <h1>Day 1 working agenda</h1>
        <p>Use the established program PIN to open the conductor view.</p>
        <label htmlFor="agenda-pin">Program PIN</label>
        <input
          id="agenda-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        {error && <p className={styles.gateError} role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Opening…" : "Open agenda"}</button>
        <small>This page uses the same private session as Day 1 attendance. Lock it when you are finished.</small>
      </form>
    </main>
  );
}
