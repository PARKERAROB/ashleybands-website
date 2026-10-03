"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Field, Notice, PageHeader } from "@/components/ui";
import AscendResults from "../AscendResults";
import {
  ASCEND_AREAS,
  ASCEND_AREA_IDS,
  ASCEND_MOVEMENTS,
  ASCEND_ZONES,
  FLAG_LABELS,
  FLAG_NOTE_MAX,
  RATINGS,
  STAFF_GROUPS,
  STAFF_NAME_MAX,
  compareAscend,
  flagCounts,
  rehearsalDate,
  sectionalPriorities,
  worstColor,
} from "@/lib/ascendCheck.mjs";
import zoneStyles from "../ascend-check.module.css";
import styles from "./staff-room.module.css";

const NAME_KEY = "ashleybands:ascend-staff:name";
const DEVICE_KEY = "ashleybands:ascend-staff:device";
const EMPTY_DRAFT = { color: null, area: null, groups: [], note: "", id: null };
const TABS = [["flag", "Flag"], ["report", "Lunch report"], ["kids", "Kids"], ["compare", "Compare"]];

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* blocked storage: keep going without it */ }
  return null;
}

async function getJson(url, init) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "That did not work. Try again.");
  return body;
}

function Pills({ c, labels = FLAG_LABELS }) {
  return <span className={styles.pills}>{RATINGS.filter((k) => c[k]).map((k) => <span key={k} className={styles.pill} data-rating={k} title={labels[k]}>{c[k]}</span>)}</span>;
}

export default function StaffRoomClient() {
  const [name, setName] = useState("");
  const [device, setDevice] = useState("");
  const [date, setDate] = useState("");
  const [tab, setTab] = useState("flag");
  const [flags, setFlags] = useState([]);
  const [kids, setKids] = useState([]);
  const [status, setStatus] = useState({ text: "Loading…", bad: false });
  const [openZone, setOpenZone] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formMsg, setFormMsg] = useState("");
  const [armed, setArmed] = useState("");
  const [onlyMismatch, setOnlyMismatch] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setName(storage(NAME_KEY) || "");
      setDate(rehearsalDate());
      let id = storage(DEVICE_KEY);
      if (!id) {
        id = crypto.randomUUID();
        storage(DEVICE_KEY, id);
      }
      setDevice(id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const headers = useCallback((extra = {}) => ({ "x-ascend-device": device, ...extra }), [device]);

  const load = useCallback(async () => {
    if (!device || !date) return;
    try {
      const [flagBody, kidBody] = await Promise.all([
        getJson(`/api/ascend-check/flags?date=${date}`, { headers: headers() }),
        getJson(`/api/ascend-check?date=${date}`),
      ]);
      setFlags(flagBody.flags);
      setKids(kidBody.submissions);
      setStatus({ text: `${flagBody.flags.length} staff flags and ${kidBody.submissions.length} student checks for ${date}. Updates every 20 seconds.`, bad: false });
    } catch (error) {
      setStatus({ text: error.message, bad: true });
    }
  }, [date, device, headers]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 20_000);
    return () => { window.clearTimeout(first); window.clearInterval(poll); };
  }, [load]);

  const openOrClose = (id) => {
    setOpenZone(openZone === id ? null : id);
    setDraft(EMPTY_DRAFT);
    setFormMsg("");
    setArmed("");
  };

  async function save() {
    if (!name.trim()) return setFormMsg("Type your name at the top first.");
    if (!draft.color || !draft.area || !draft.groups.length) return setFormMsg("Pick how it is, an area and at least one group.");
    setFormMsg("Saving…");
    try {
      await getJson("/api/ascend-check/flags", {
        method: draft.id ? "PATCH" : "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: draft.id, date, zone: openZone, color: draft.color, area: draft.area, groups: draft.groups, note: draft.note, name }),
      });
      setDraft(EMPTY_DRAFT);
      setFormMsg(draft.id ? "Saved." : "Flag added.");
      await load();
    } catch (error) {
      setFormMsg(error.message);
    }
  }

  async function remove(id) {
    if (armed !== id) return setArmed(id);
    try {
      await getJson(`/api/ascend-check/flags?id=${id}`, { method: "DELETE", headers: headers() });
      setArmed("");
      await load();
    } catch (error) {
      setFormMsg(error.message);
    }
  }

  const toggleGroup = (g) => setDraft((d) => ({ ...d, groups: d.groups.includes(g) ? d.groups.filter((x) => x !== g) : [...d.groups, g] }));

  return <main className={zoneStyles.page}>
    <PageHeader title="Ascend Staff Room" lede="Flag what you see during the runs. At lunch, check the report and compare it with what the kids said." />

    <section className={zoneStyles.who} aria-label="Who and when">
      <Field label="Your name">
        <input value={name} maxLength={STAFF_NAME_MAX} autoComplete="name" className={zoneStyles.input}
          onChange={(e) => { setName(e.target.value); storage(NAME_KEY, e.target.value.trim()); }} />
      </Field>
      <Field label="Rehearsal date">
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={zoneStyles.input} />
      </Field>
    </section>

    <div className={styles.tabs} role="group" aria-label="View">
      {TABS.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    <p className={status.bad ? styles.bad : zoneStyles.muted} aria-live="polite">{status.text}</p>

    {tab === "flag" ? ASCEND_MOVEMENTS.map(([title], index) => <section key={title}>
      <h2 className={zoneStyles.movement}>M{index + 1}: {title}</h2>
      {[...new Set(ASCEND_ZONES.filter((z) => z.movement === index + 1).map((z) => z.chunk))].map((chunk) => <div key={chunk}>
        <p className={zoneStyles.chunk}>Chunk {chunk}</p>
        {ASCEND_ZONES.filter((z) => z.movement === index + 1 && z.chunk === chunk).map((zone) => {
          const list = flags.filter((f) => f.zone === zone.id);
          const open = openZone === zone.id;
          return <div className={zoneStyles.zone} key={zone.id}>
            <button type="button" className={zoneStyles.zoneHead} aria-expanded={open} onClick={() => openOrClose(zone.id)}>
              <span className={zoneStyles.zoneId}>{zone.sets}</span>
              <span className={zoneStyles.zoneMeta}><b>m{zone.measures}</b> · {zone.letters}{zone.hit ? <span className={zoneStyles.hit}> · hit</span> : null}</span>
              <Pills c={flagCounts(list)} />
            </button>
            {open ? <div className={zoneStyles.zoneBody}>
              <fieldset className={zoneStyles.area}>
                <legend className={zoneStyles.label}>How is it?</legend>
                <div className={zoneStyles.segment}>{RATINGS.map((c) => <button type="button" key={c} data-rating={c} aria-pressed={draft.color === c} onClick={() => setDraft((d) => ({ ...d, color: c }))}>{FLAG_LABELS[c]}</button>)}</div>
              </fieldset>
              <fieldset className={zoneStyles.area}>
                <legend className={zoneStyles.label}>Area</legend>
                <div className={zoneStyles.segment}>{ASCEND_AREA_IDS.map((a) => <button type="button" key={a} className={styles.choice} aria-pressed={draft.area === a} onClick={() => setDraft((d) => ({ ...d, area: a }))}>{ASCEND_AREAS[a].label}</button>)}</div>
              </fieldset>
              <fieldset className={zoneStyles.area}>
                <legend className={zoneStyles.label}>Groups</legend>
                <div className={styles.chips}>{STAFF_GROUPS.map((g) => <button type="button" key={g} className={styles.choice} aria-pressed={draft.groups.includes(g)} onClick={() => toggleGroup(g)}>{g}</button>)}</div>
              </fieldset>
              <Field label="What's the issue? (optional)">
                <textarea value={draft.note} maxLength={FLAG_NOTE_MAX} rows={2} placeholder="m102 entrance late, guard toss timing" className={zoneStyles.input}
                  onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
              </Field>
              <div className={styles.row}>
                <Button onClick={save}>{draft.id ? "Save changes" : "Add flag"}</Button>
                {draft.id ? <Button variant="quiet" onClick={() => setDraft(EMPTY_DRAFT)}>Cancel</Button> : null}
                <span className={zoneStyles.muted} aria-live="polite">{formMsg}</span>
              </div>
              {list.length ? <div>
                <p className={zoneStyles.label}>Flags for this date</p>
                {[...list].sort((a, b) => RATINGS.indexOf(a.color) - RATINGS.indexOf(b.color)).map((f) => <div key={f.id} className={styles.flag} data-rating={f.color}>
                  <b>{FLAG_LABELS[f.color]}</b> · <span className={styles.tag}>{ASCEND_AREAS[f.area].label}</span> · {f.groups.join(", ")}
                  {f.note ? <p>{f.note}</p> : null}
                  <span className={zoneStyles.muted}>{f.name}</span>
                  {f.mine ? <div className={styles.row}>
                    <Button variant="secondary" onClick={() => setDraft({ id: f.id, color: f.color, area: f.area, groups: [...f.groups], note: f.note })}>Edit</Button>
                    <Button variant="quiet" onClick={() => remove(f.id)}>{armed === f.id ? "Tap again to delete" : "Delete"}</Button>
                  </div> : null}
                </div>)}
              </div> : null}
            </div> : null}
          </div>;
        })}
      </div>)}
    </section>) : null}

    {tab === "report" ? <Report flags={flags} date={date} /> : null}
    {tab === "kids" && date ? <AscendResults fetcher={getJson} endpoint="/api/ascend-check" date={date} /> : null}
    {tab === "compare" ? <Compare flags={flags} kids={kids} onlyMismatch={onlyMismatch} setOnlyMismatch={setOnlyMismatch} /> : null}
  </main>;
}

function Report({ flags, date }) {
  if (!flags.length) return <p className={zoneStyles.empty}>No staff flags for {date} yet. Flags show up here as staff add them on the Flag tab.</p>;
  const groups = sectionalPriorities(flags);
  return <>
    <h2 className={zoneStyles.movement}>Sectional priorities</h2>
    <p className={zoneStyles.muted}>{flags.length} flags from {new Set(flags.map((f) => f.name)).size} staff. Sectional counts twice, Needs reps once.</p>
    {groups.length ? groups.map(({ group, rows }) => <article key={group} className={styles.group}>
      <h3>{group}</h3>
      {rows.map(({ zone, flags: list }) => <div key={zone.id} className={styles.item}>
        <p><b>Sets {zone.sets}</b> <span className={zoneStyles.muted}>m{zone.measures} · {zone.letters}</span> <Pills c={flagCounts(list)} /></p>
        <ul>{list.map((f) => <li key={f.id}><span className={styles.tag}>{ASCEND_AREAS[f.area].label}</span> {f.note || "(no note)"} <span className={zoneStyles.muted}>({f.name})</span></li>)}</ul>
      </div>)}
    </article>) : <p className={zoneStyles.empty}>Nothing is marked Sectional or Needs reps yet.</p>}
    <h2 className={zoneStyles.movement}>Show heat map</h2>
    <div className={styles.tableWrap}>
      <table className={styles.heat}>
        <thead><tr><th scope="col">Zone</th>{ASCEND_AREA_IDS.map((a) => <th scope="col" key={a}>{ASCEND_AREAS[a].label}</th>)}</tr></thead>
        <tbody>{ASCEND_ZONES.map((zone) => <tr key={zone.id}>
          <th scope="row">{zone.sets} <span className={zoneStyles.muted}>m{zone.measures}</span></th>
          {ASCEND_AREA_IDS.map((a) => {
            const list = flags.filter((f) => f.zone === zone.id && f.area === a);
            const c = flagCounts(list);
            return <td key={a} data-rating={worstColor(list) || undefined}>{list.length ? [c.red && `${c.red} Sectional`, c.yellow && `${c.yellow} Reps`, !c.red && !c.yellow && "Clean"].filter(Boolean).join(", ") : "–"}</td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

function Compare({ flags, kids, onlyMismatch, setOnlyMismatch }) {
  const rows = compareAscend(flags, kids);
  const total = rows.reduce((s, r) => s + r.mismatch, 0);
  const shown = onlyMismatch ? rows.filter((r) => r.mismatch) : rows;
  return <>
    <h2 className={zoneStyles.movement}>Staff flags next to the kids</h2>
    {total ? <Notice tone="deadline" title={`${total} student "Got it" ratings where staff flagged a problem.`}>
      <p>Those cells are outlined below.</p>
    </Notice> : <p className={zoneStyles.muted}>No mismatches yet: no student said Got it where staff flagged Sectional or Needs reps.</p>}
    <label className={zoneStyles.check}><input type="checkbox" checked={onlyMismatch} onChange={(e) => setOnlyMismatch(e.target.checked)} /> Only zones with a mismatch</label>
    <div className={styles.tableWrap}>
      <table className={styles.heat}>
        <thead><tr><th scope="col">Zone</th>{ASCEND_AREA_IDS.map((a) => <th scope="col" key={a}>{ASCEND_AREAS[a].label}</th>)}</tr></thead>
        <tbody>{shown.map(({ zone, areas }) => <tr key={zone.id}>
          <th scope="row">{zone.sets} <span className={zoneStyles.muted}>m{zone.measures}</span></th>
          {areas.map((cell) => <td key={cell.area} className={styles.compareCell} data-mismatch={cell.mismatch ? true : undefined}>
            <span className={styles.who}>Staff</span> {cell.worst ? <span className={styles.pill} data-rating={cell.worst}>{FLAG_LABELS[cell.worst]}</span> : "–"}
            <br />
            <span className={styles.who}>Kids</span> {cell.students.red + cell.students.yellow + cell.students.green
              ? `${cell.students.red} Lost, ${cell.students.yellow} Shaky, ${cell.students.green} Got it`
              : "–"}
            {cell.mismatch ? <strong className={styles.mismatch}>{cell.mismatch} said Got it</strong> : null}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
