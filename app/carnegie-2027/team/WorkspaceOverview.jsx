"use client";
import Link from "next/link";
import { Entry, coordinationKinds } from "./CoordinationPanel";
import styles from "./workspace.module.css";

export default function WorkspaceOverview({ state, actor, people, navigate }) {
  const mine = state.commitments.filter(row => row.owner_id === actor.id && !["completed", "declined"].includes(row.status));
  const reviews = state.proposals.filter(row => row.status === "pending" && state.records.find(record => record.id === row.record_id)?.owner_id === actor.id);
  const unconfirmed = state.records.filter(row => row.owner_id === actor.id && row.status === "unconfirmed");
  const latest = state.records.filter(row => coordinationKinds[row.kind] && row.kind !== "reported_decision").sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  const assessment = latest.find(row => row.kind === "assessment");
  const feed = latest.filter(row => row.id !== assessment?.id);
  const author = (row) => people.find(person => person.id === row.updated_by)?.display_name || "Former writer";
  return <div className={styles.overview}>
    <div>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>Needs you</h2><button onClick={() => navigate("attention")}>View all ↗</button></div>
        {!mine.length && !reviews.length && !unconfirmed.length && <p className={styles.muted}>Nothing awaiting you.</p>}
        {mine.slice(0, 4).map(row => <button className={styles.attentionRow} key={row.id} onClick={() => navigate("commitments")}><span className={styles.rowIcon} aria-hidden="true">✓</span><span><strong>{row.title}</strong>{row.due && <small>Due {row.due}</small>}</span><span className={styles.badge}>{row.status}</span></button>)}
        {mine.length > 4 && <button className={styles.textLink} onClick={() => navigate("commitments")}>{mine.length - 4} more actions ↗</button>}
        {!!reviews.length && <button className={styles.attentionRow} onClick={() => navigate("records")}><span className={styles.rowIcon} aria-hidden="true">↗</span><span><strong>{reviews.length} proposed {reviews.length === 1 ? "update" : "updates"}</strong><small>Awaiting your review</small></span></button>}
        {!!unconfirmed.length && <button className={styles.attentionRow} onClick={() => navigate("records")}><span className={styles.rowIcon} aria-hidden="true">▤</span><span><strong>{unconfirmed.length} unconfirmed {unconfirmed.length === 1 ? "record" : "records"}</strong><small>Review source evidence</small></span></button>}
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>Latest updates</h2><button onClick={() => navigate("coordination")}>View all ↗</button></div>
        {!feed.length && <p className={styles.muted}>No updates yet.</p>}
        {feed.slice(0, 4).map(row => <Entry key={row.id} row={row}><p className={styles.muted}>{author(row)}</p><p>Source: {row.source}</p><button onClick={() => navigate("coordination")}>Open updates ↗</button></Entry>)}
      </section>
    </div>
    <aside>
      {assessment && <section className={styles.panel}><div className={styles.panelHeading}><h2>Assessment</h2></div><p className={styles.muted}>{author(assessment)}</p><Entry row={assessment}><p>Source: {assessment.source}</p></Entry></section>}
      <section className={styles.panel}><h2>Sources</h2><div className={styles.sources}><button onClick={() => navigate("records")}>Reference <span aria-hidden="true">↗</span></button><button onClick={() => navigate("documents")}>Documents <span aria-hidden="true">↗</span></button><Link href="/info/carnegie-2027">Trip information <span aria-hidden="true">↗</span></Link><Link href="/support-carnegie">Funding <span aria-hidden="true">↗</span></Link></div></section>
    </aside>
  </div>;
}
