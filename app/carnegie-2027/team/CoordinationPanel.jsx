"use client";
import Link from "next/link";
import { useState } from "react";
import styles from "./workspace.module.css";
const kinds = { update: "Progress update", opportunity: "Opportunity / next action", assessment: "Assessment", recommendation: "Recommendation / needs a decision", reported_decision: "Decision already communicated", volunteer_response: "Volunteer response" };
function Entry({ row, children }) {
  return <article className={styles.card}>
    <h3>{row.title}</h3><p className={styles.muted}>{kinds[row.kind] || row.kind} · {row.status}</p>
    <p style={{ whiteSpace: "pre-wrap" }}>{row.value}</p>
    {row.attributed_to && <p>{row.attributed_to} · {row.occurred_on}{row.response ? ` · ${row.response}` : ""} · recorded report</p>}
    <p className={styles.muted}>Updated {new Date(row.updated_at).toLocaleString()}</p>{children}
  </article>;
}
export function TeamView({ rows }) {
  return <section><h2>Team view</h2><p>Current entries selected for the team by the workspace writers.</p>
    <p><Link href="/info/carnegie-2027">Official trip information</Link> · <Link href="/support-carnegie">Current funding and giving information</Link></p>
    {!rows.length && <p>No entries have been shared with the team yet.</p>}
    {rows.map(row => <Entry key={row.id} row={row} />)}
  </section>;
}
export default function CoordinationPanel({ records, people, actor, mutate, busy }) {
  const [editing, setEditing] = useState(null);
  const [kind, setKind] = useState("update");
  const rows = records.filter(r => r.domain === "coordination" && kinds[r.kind]);
  const attribution = ["reported_decision", "volunteer_response"].includes(kind);
  function edit(row) { setEditing(row); setKind(row?.kind || "update"); }
  return <section>
    <h2>Coordination</h2><p>Keep progress, next actions and recommendations here. Record a decision already made with its source. A request for someone&apos;s time remains a request until they accept.</p>
    {actor.domains.includes("coordination") && <form key={editing?.id || "new"} className={styles.card} onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      if (await mutate({ ...values, action: "coordination.save", id: editing?.id, base_version: editing?.version, team_visible: values.team_visible === "on" })) { form.reset(); edit(null); }
    }}>
      <h3>{editing ? "Edit coordination entry" : "Add coordination entry"}</h3>
      <label className={styles.field}>Type<select name="kind" value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(kinds).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label>
      <label className={styles.field}>Title<input name="title" required maxLength={160} defaultValue={editing?.title || ""} /></label>
      <label className={styles.field}>Update and next action<textarea name="value" required maxLength={2000} rows={4} defaultValue={editing?.value || ""} /></label>
      {attribution && <><label className={styles.field}>Person who made the decision or gave the response<input name="attributed_to" required maxLength={160} defaultValue={editing?.attributed_to || ""} /></label>
        <label className={styles.field}>Date communicated<input type="date" name="occurred_on" required defaultValue={editing?.occurred_on || ""} /></label>
        <p>Identify the actual person and evidence. This records their report; it does not accept a workspace commitment for them.</p></>}
      {kind === "volunteer_response" && <label className={styles.field}>Response<select name="response" defaultValue={editing?.response || "requested"}>{["requested", "accepted", "declined", "waiting", "completed"].map(s => <option key={s}>{s}</option>)}</select></label>}
      <label className={styles.field}>Source and date<input name="source" required maxLength={1000} defaultValue={editing?.source || ""} /></label>
      <label><input type="checkbox" name="team_visible" defaultChecked={editing?.team_visible || false} /> Share this entry in the team view. I reviewed its content and attribution for that audience.</label>
      <div className={styles.actions}><button disabled={busy}>Save coordination entry</button>{editing && <button type="button" onClick={() => edit(null)}>Start a new entry</button>}</div>
    </form>}
    {rows.slice().reverse().map(row => <Entry key={row.id} row={row}>
      <p>Source: {row.source}</p><p className={styles.muted}>Recorded by {people.find(p => p.id === row.updated_by)?.display_name || "Former writer"} · {row.team_visible ? "Shared with team" : "Writers only"}</p>
      {actor.domains.includes("coordination") && <button disabled={busy} onClick={() => edit(row)}>Edit entry</button>}
    </Entry>)}
  </section>;
}
