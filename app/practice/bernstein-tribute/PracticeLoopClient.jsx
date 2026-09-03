"use client";

import { useEffect, useRef, useState } from "react";
import {
  getPracticePiece,
  INSTRUMENTS,
  practiceRanges,
  PRACTICE_STATUSES,
} from "@/lib/practiceLoop.mjs";
import styles from "./practice-loop.module.css";

const PROFILE_STORAGE_KEY = "ashleybands:practice-loop:profile:v1";
const STATUS_LABELS = { red: "Not yet", yellow: "Working", green: "Ready" };
const EMPTY = { participantToken: "", displayName: "", instrument: "", marks: {} };

function freshToken() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "";
}

export default function PracticeLoopClient({ pieceSlug = "bernstein-tribute" }) {
  const piece = getPracticePiece(pieceSlug);
  const storageKey = piece.storageKey;
  const ranges = practiceRanges(piece);
  const [practice, setPractice] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [error, setError] = useState("");
  const saveSequence = useRef(0);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
        const profile = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
        if (stored?.participantToken) {
          setPractice({ ...EMPTY, ...stored, marks: stored.marks || {} });
          setProfileOpen(!stored.displayName || !stored.instrument);
        } else {
          const next = {
            ...EMPTY,
            participantToken: freshToken(),
            displayName: profile?.displayName || "",
            instrument: profile?.instrument || "",
          };
          setPractice(next);
          setProfileOpen(!next.displayName || !next.instrument);
        }
      } catch {
        setPractice({ ...EMPTY, participantToken: freshToken() });
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [storageKey]);

  const save = async (next) => {
    if (!next.displayName.trim() || !next.instrument || !next.participantToken) return false;
    const sequence = ++saveSequence.current;
    localStorage.setItem(storageKey, JSON.stringify(next));
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
      displayName: next.displayName,
      instrument: next.instrument,
    }));
    setSaveState("saving");
    setError("");
    const operation = saveQueue.current.catch(() => {}).then(async () => {
      try {
        const response = await fetch(`/api/practice-loop/${pieceSlug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Your practice marks could not be saved.");
        if (sequence === saveSequence.current) setSaveState("saved");
        return true;
      } catch (saveError) {
        if (sequence === saveSequence.current) {
          setSaveState("error");
          setError(saveError.message);
        }
        return false;
      }
    });
    saveQueue.current = operation;
    return operation;
  };

  const updateProfile = async (event) => {
    event.preventDefault();
    const next = { ...practice, participantToken: practice.participantToken || freshToken() };
    if (!next.displayName.trim()) return setError("Enter your name.");
    if (!next.instrument) return setError("Choose your instrument.");
    setPractice(next);
    if (await save(next)) setProfileOpen(false);
  };

  const mark = (rangeId, status) => {
    const marks = { ...practice.marks };
    if (marks[rangeId] === status) delete marks[rangeId];
    else marks[rangeId] = status;
    const next = { ...practice, marks };
    setPractice(next);
    void save(next);
  };

  const counts = PRACTICE_STATUSES.reduce((result, status) => ({
    ...result,
    [status]: Object.values(practice.marks).filter((markStatus) => markStatus === status).length,
  }), {});
  const marked = Object.keys(practice.marks).length;

  if (!ready) return <main className={styles.page}><p>Opening your practice map…</p></main>;

  return <main className={styles.page}>
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Ashley Bands practice prototype</p>
      <h1><em>{piece.title}</em></h1>
      <p className={styles.credit}>{piece.credit}</p>
      <p className={styles.lede}>Mark what is true right now. Tap the same choice again to clear it.</p>
    </header>

    {profileOpen ? <form className={styles.profileCard} onSubmit={updateProfile}>
      <div><p className={styles.step}>First, identify your practice map</p><h2>Name and instrument</h2></div>
      <label>Name<input value={practice.displayName} maxLength={80} autoComplete="name" onChange={(event) => setPractice({ ...practice, displayName: event.target.value })} /></label>
      <label>Instrument<select value={practice.instrument} onChange={(event) => setPractice({ ...practice, instrument: event.target.value })}>
        <option value="">Choose…</option>
        {INSTRUMENTS.map((instrument) => <option value={instrument} key={instrument}>{instrument}</option>)}
      </select></label>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button className={styles.primary} type="submit">Open my practice map</button>
      <p className={styles.privacy}>No account is created. Your name, instrument, and marks are visible to Mr. Parker on the private staff dashboard.</p>
    </form> : <>
      <section className={styles.identityBar}>
        <div><strong>{practice.displayName}</strong><span>{practice.instrument}</span></div>
        <button type="button" onClick={() => setProfileOpen(true)}>Change</button>
      </section>

      <section className={styles.summary} aria-label="Your current practice summary">
        <div><strong>{marked}</strong><span>of {ranges.length} marked</span></div>
        <div data-status="red"><strong>{counts.red}</strong><span>Not yet</span></div>
        <div data-status="yellow"><strong>{counts.yellow}</strong><span>Working</span></div>
        <div data-status="green"><strong>{counts.green}</strong><span>Ready</span></div>
      </section>

      <div className={styles.saveLine} aria-live="polite">
        {saveState === "saving" ? "Saving…" : null}
        {saveState === "saved" ? "Saved for Mr. Parker" : null}
        {saveState === "error" ? error : null}
      </div>

      <section className={styles.map} aria-label="Rehearsal ranges">
        {piece.movements.map((movement) => <section className={styles.movement} key={movement.key}>
          {piece.movements.length > 1 ? <header className={styles.movementHeading}>
            <p>Movement {movement.number}</p>
            <h2>{movement.title}</h2>
          </header> : null}
          <div className={styles.movementMap}>
            {ranges.filter((range) => range.movementKey === movement.key).map((range) => <article className={styles.rangeCard} data-large-change={range.largeChange || undefined} key={range.id}>
              {range.largeChange ? <p className={styles.changeLabel}>Large musical change</p> : null}
              <div className={styles.rangeHeading}>
                <div><span>Rehearsal number</span><strong>{range.start}</strong></div>
                <p>Measures {range.start}–{range.end}</p>
              </div>
              <div className={styles.markButtons} aria-label={`Mark ${movement.title}, measures ${range.start} through ${range.end}`}>
                {PRACTICE_STATUSES.map((status) => <button
                  type="button"
                  data-status={status}
                  aria-pressed={practice.marks[range.id] === status}
                  onClick={() => mark(range.id, status)}
                  key={status}
                >{STATUS_LABELS[status]}</button>)}
              </div>
            </article>)}
          </div>
        </section>)}
      </section>
    </>}
  </main>;
}
