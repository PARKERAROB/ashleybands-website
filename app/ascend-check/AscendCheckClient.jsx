"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button, Field, Notice, PageHeader } from "@/components/ui";
import {
  ASCEND_AREAS,
  ASCEND_AREA_IDS,
  ASCEND_MOVEMENTS,
  ASCEND_ZONES,
  NOTE_MAX,
  RATINGS,
  RATING_LABELS,
  normalizeDrillNumber,
} from "@/lib/ascendCheck.mjs";
import styles from "./ascend-check.module.css";

const STORAGE_KEY = "ashleybands:ascend-check:v1";
const SEVERITY = { red: 2, yellow: 1, green: 0 };
const localDay = () => new Date().toLocaleDateString("en-CA");
const EMPTY_ZONE = { rate: {}, checks: {}, note: "" };

export default function AscendCheckClient() {
  const [draft, setDraft] = useState({ day: "", drill: "", code: "", zones: {} });
  const [ready, setReady] = useState(false);
  const [openZone, setOpenZone] = useState(null);
  const [tab, setTab] = useState("rate");
  const [drillError, setDrillError] = useState("");
  const [send, setSend] = useState({ status: "idle", message: "" });

  // Restore the draft after mount. Ratings reset on a new day; drill number and code stay.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved) setDraft({ day: localDay(), drill: saved.drill || "", code: saved.code || "", zones: saved.day === localDay() ? saved.zones || {} : {} });
      } catch { /* private window or blocked storage: start empty */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, day: localDay() })); } catch { /* ignore */ }
  }, [draft, ready]);

  const zoneData = (id) => draft.zones[id] || EMPTY_ZONE;
  const updateZone = (id, change) => {
    setSend({ status: "idle", message: "" });
    setDraft((d) => ({ ...d, zones: { ...d.zones, [id]: change(d.zones[id] || EMPTY_ZONE) } }));
  };
  const setRating = (id, area, value) => updateZone(id, (z) => ({ ...z, rate: { ...z.rate, [area]: z.rate[area] === value ? undefined : value } }));
  const toggleCheck = (id, area, index) => updateZone(id, (z) => {
    const list = z.checks[area] || [];
    return { ...z, checks: { ...z.checks, [area]: list.includes(index) ? list.filter((i) => i !== index) : [...list, index] } };
  });
  const clearZone = (id) => setDraft((d) => {
    const zones = { ...d.zones };
    delete zones[id];
    return { ...d, zones };
  });

  const rated = ASCEND_ZONES.filter((z) => Object.values(zoneData(z.id).rate).some(Boolean)).length;

  async function sendToStaff() {
    let drillNumber;
    try {
      drillNumber = normalizeDrillNumber(draft.drill);
      setDrillError("");
      setDraft((d) => ({ ...d, drill: drillNumber }));
    } catch (error) {
      setDrillError(error.message);
      return;
    }
    setSend({ status: "sending", message: "" });
    try {
      const response = await fetch("/api/ascend-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillNumber, code: draft.code, zones: draft.zones }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Your self check could not be sent. Try again.");
      const time = new Date(body.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setSend({ status: "sent", message: `Sent for ${drillNumber} at ${time}. Send again any time today to update it.` });
    } catch (error) {
      setSend({ status: "error", message: error.message });
    }
  }

  return <main className={styles.page}>
    <PageHeader
      title="Ascend Self Check"
      lede="Rate yourself on each cleaning zone after a rep. Then send it to the staff."
    />

    <section className={styles.who} aria-label="Who is sending">
      <Field label="Drill number" hint="One letter and a number, like T3 or G10." error={drillError}>
        <input
          value={draft.drill}
          onChange={(e) => { setDrillError(""); setDraft((d) => ({ ...d, drill: e.target.value })); }}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={8}
          className={styles.input}
        />
      </Field>
      <Field label="Rehearsal code" hint="Staff will tell you the code.">
        <input
          value={draft.code}
          onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={40}
          className={styles.input}
        />
      </Field>
    </section>

    <div className={styles.tabs} role="group" aria-label="View">
      <button type="button" aria-pressed={tab === "rate"} onClick={() => setTab("rate")}>Rate</button>
      <button type="button" aria-pressed={tab === "fix"} onClick={() => setTab("fix")}>My fix list</button>
    </div>

    {tab === "rate" ? ASCEND_MOVEMENTS.map(([title], index) => <section key={title}>
      <h2 className={styles.movement}>M{index + 1}: {title}</h2>
      {[...new Set(ASCEND_ZONES.filter((z) => z.movement === index + 1).map((z) => z.chunk))].map((chunk) => <div key={chunk}>
        <p className={styles.chunk}>Chunk {chunk}</p>
        {ASCEND_ZONES.filter((z) => z.movement === index + 1 && z.chunk === chunk).map((zone) => {
          const data = zoneData(zone.id);
          const open = openZone === zone.id;
          return <div className={styles.zone} key={zone.id}>
            <button type="button" className={styles.zoneHead} aria-expanded={open} onClick={() => setOpenZone(open ? null : zone.id)}>
              <span className={styles.zoneId}>{zone.sets}</span>
              <span className={styles.zoneMeta}><b>m{zone.measures}</b> · {zone.letters}{zone.hit ? <span className={styles.hit}> · hit</span> : null}</span>
              <span className={styles.dots}>
                {ASCEND_AREA_IDS.map((area) => <span key={area} className={styles.dot} data-rating={data.rate[area] || undefined} />)}
                <span className={styles.srOnly}>{ASCEND_AREA_IDS.map((a) => `${ASCEND_AREAS[a].label}: ${RATING_LABELS[data.rate[a]] || "not rated"}`).join(", ")}</span>
              </span>
            </button>
            {open ? <div className={styles.zoneBody}>
              {ASCEND_AREA_IDS.map((area) => <fieldset key={area} className={styles.area}>
                <legend className={styles.label}>{ASCEND_AREAS[area].label}</legend>
                <div className={styles.segment}>
                  {RATINGS.map((rating) => <button
                    type="button"
                    key={rating}
                    data-rating={rating}
                    aria-pressed={data.rate[area] === rating}
                    onClick={() => setRating(zone.id, area, rating)}
                  >{RATING_LABELS[rating]}</button>)}
                </div>
                {ASCEND_AREAS[area].checks.map((text, i) => <label key={text} className={styles.check}>
                  <input type="checkbox" checked={(data.checks[area] || []).includes(i)} onChange={() => toggleCheck(zone.id, area, i)} />
                  {text}
                </label>)}
              </fieldset>)}
              <Field label="Fix next rep" hint={`Up to ${NOTE_MAX} characters.`}>
                <textarea
                  value={data.note}
                  maxLength={NOTE_MAX}
                  rows={2}
                  placeholder="Late off set 30, guide left"
                  onChange={(e) => updateZone(zone.id, (z) => ({ ...z, note: e.target.value }))}
                  className={styles.input}
                />
              </Field>
              <Button variant="quiet" onClick={() => clearZone(zone.id)}>Clear this zone</Button>
            </div> : null}
          </div>;
        })}
      </div>)}
    </section>) : <FixList zones={draft.zones} />}

    <section className={styles.sendBar} aria-live="polite">
      {send.status === "sent" ? <Notice tone="success" title="Sent to staff.">{send.message}</Notice> : null}
      {send.status === "error" ? <Notice tone="error" title="Not sent yet.">{send.message}</Notice> : null}
      <Button onClick={sendToStaff} disabled={send.status === "sending" || !rated}>
        <Send size={20} aria-hidden="true" /> {send.status === "sending" ? "Sending…" : `Send to staff (${rated} ${rated === 1 ? "zone" : "zones"})`}
      </Button>
    </section>
    <p className={styles.muted}><Link href="/ascend-check/results">See everyone&apos;s results</Link></p>
  </main>;
}

function FixList({ zones }) {
  const rows = ASCEND_ZONES.map((zone) => {
    const data = zones[zone.id];
    if (!data) return null;
    const bad = ASCEND_AREA_IDS.filter((a) => data.rate[a] && data.rate[a] !== "green");
    const score = bad.reduce((sum, a) => sum + SEVERITY[data.rate[a]], 0);
    const missed = bad.flatMap((a) => ASCEND_AREAS[a].checks
      .map((text, i) => ((data.checks[a] || []).includes(i) ? null : { area: a, text }))
      .filter(Boolean));
    return score || data.note?.trim() ? { zone, data, bad, missed, score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  return <section>
    <h2 className={styles.movement}>My fix list</h2>
    <p className={styles.muted}>Worst first. Show this to your section leader at the break.</p>
    {rows.length ? rows.map(({ zone, data, bad, missed }) => <article key={zone.id} className={styles.fix} data-rating={bad.some((a) => data.rate[a] === "red") ? "red" : bad.length ? "yellow" : undefined}>
      <h3>Sets {zone.sets} <span className={styles.zoneMeta}>m{zone.measures} · {zone.letters}</span></h3>
      <p className={styles.pills}>{bad.map((a) => <span key={a} className={styles.pill} data-rating={data.rate[a]}>{ASCEND_AREAS[a].label}: {RATING_LABELS[data.rate[a]]}</span>)}</p>
      {missed.length ? <ul>{missed.map(({ area, text }) => <li key={area + text}><b>{ASCEND_AREAS[area].label}</b> {text}</li>)}</ul> : null}
      {data.note?.trim() ? <p>{data.note}</p> : null}
    </article>) : <p className={styles.empty}>Nothing to fix yet. Open a zone on the Rate tab and mark Music, Choreo and Marching. Anything Shaky or Lost shows up here.</p>}
  </section>;
}
