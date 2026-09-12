"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import styles from "./workspace.module.css";
export const coordinationKinds = { update: "Update", opportunity: "Opportunity", assessment: "Assessment", recommendation: "Recommendation", reported_decision: "Reported decision", volunteer_response: "Volunteer response" };
export function Entry({ row, children }) {
  return <details className={styles.entry}>
    <summary><span className={styles.entryMeta}>{coordinationKinds[row.kind] || row.kind} · {row.status}</span><h3>{row.title}</h3><span className={styles.excerpt}>{row.value}</span></summary>
    <div className={styles.entryDetail}><p className={styles.value}>{row.value}</p>
      {row.attributed_to && <p>{row.attributed_to} · {row.occurred_on}{row.response ? ` · ${row.response}` : ""} · reported</p>}
      <p className={styles.muted}>{new Date(row.updated_at).toLocaleString()}</p>{children}
    </div>
  </details>;
}
export function TeamView({ rows }) {
  return <section>
    <p className={styles.sourceLinks}><Link href="/info/carnegie-2027">Trip information ↗</Link><Link href="/support-carnegie">Funding ↗</Link></p>
    {!rows.length && <p className={styles.empty}>No shared entries yet.</p>}
    {rows.map(row => <Entry key={row.id} row={row} />)}
  </section>;
}
export default function CoordinationPanel({ records, people, actor, mutate, busy, composer, setComposer }) {
  const [editing, setEditing] = useState(null);
  const [kind, setKind] = useState("update");
  const formRef = useRef(null);
  const rows = records.filter(r => r.domain === "coordination" && coordinationKinds[r.kind]).sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
  const attribution = ["reported_decision", "volunteer_response"].includes(kind);
  function edit(row) { setEditing(row); setKind(row?.kind || "update"); setComposer(true); requestAnimationFrame(() => { formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); formRef.current?.elements.namedItem("title")?.focus({preventScroll: true}); }); }
  function close() { setEditing(null); setKind("update"); setComposer(false); }
  return <section>
    {actor.domains.includes("coordination") && composer && <form ref={formRef} key={editing?.id || "new"} className={`${styles.card} ${styles.composer}`} onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      if (await mutate({ ...values, action: "coordination.save", id: editing?.id, base_version: editing?.version, team_visible: values.team_visible === "on" })) { close(); }
    }}>
      <h2>{editing ? "Edit update" : "New update"}</h2>
      <div className={styles.field}><label htmlFor="coordination-kind">Type</label><select id="coordination-kind" name="kind" value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(coordinationKinds).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></div>
      <label className={styles.field}>Title<input name="title" required maxLength={160} defaultValue={editing?.title || ""} /></label>
      <div className={styles.field}><label htmlFor="coordination-value">Update</label><textarea id="coordination-value" name="value" required maxLength={2000} rows={4} defaultValue={editing?.value || ""} /></div>
      {attribution && <><label className={styles.field}>Reported by<input name="attributed_to" required maxLength={160} defaultValue={editing?.attributed_to || ""} /></label>
        <label className={styles.field}>Date communicated<input type="date" name="occurred_on" required defaultValue={editing?.occurred_on || ""} /></label></>}
      {kind === "volunteer_response" && <div className={styles.field}><label htmlFor="coordination-response">Response</label><select id="coordination-response" name="response" defaultValue={editing?.response || "requested"}>{["requested", "accepted", "declined", "waiting", "completed"].map(s => <option key={s}>{s}</option>)}</select></div>}
      <label className={styles.field}>Source and date<input name="source" required maxLength={1000} defaultValue={editing?.source || ""} /></label>
      <label className={styles.check}><input type="checkbox" name="team_visible" defaultChecked={editing?.team_visible || false} /> Reviewed for team sharing</label>
      <div className={styles.actions}><button className={styles.primary} disabled={busy}>Save update</button><button type="button" disabled={busy} onClick={close}>Cancel</button></div>
    </form>}
    {!rows.length && !composer && <p className={styles.empty}>No updates yet.</p>}
    {rows.map(row => <Entry key={row.id} row={row}>
      <p>Source: {row.source}</p><p className={styles.muted}>{people.find(p => p.id === row.updated_by)?.display_name || "Former writer"} · {row.team_visible ? "Shared with team" : "Writers only"}</p>
      {actor.domains.includes("coordination") && <button disabled={busy} onClick={() => edit(row)}>Edit update</button>}
    </Entry>)}
  </section>;
}
