"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import {
  LETTER_STATUSES,
  LETTER_STATUS_LABELS,
  REPORTED_GIFT_STATUS_LABELS,
  composeCarnegieLetter,
  letterIsPrintable,
  recipientTypeLabel
} from "@/lib/carnegieLetters.mjs";
import styles from "./review.module.css";

const dollars = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: (Number(cents) || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const when = (value) => (value ? new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function LettersReviewClient({ previewMode = false }) {
  return (
    <main className={styles.shell}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>Staff · Carnegie student campaign</p>
        <h1 className={styles.title}>Letters and reported gifts</h1>
        {previewMode ? <p className={styles.preview}>Staff preview. Families cannot see the letter campaign yet.</p> : null}
        <StaffGate>{() => <Queues />}</StaffGate>
      </div>
    </main>
  );
}

function Queues() {
  const [tab, setTab] = useState("letters");
  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={tab === "letters"} className={tab === "letters" ? styles.tabActive : styles.tab} onClick={() => setTab("letters")}>Letters to review</button>
        <button type="button" role="tab" aria-selected={tab === "gifts"} className={tab === "gifts" ? styles.tabActive : styles.tab} onClick={() => setTab("gifts")}>Reported gifts to confirm</button>
      </div>
      {tab === "letters" ? <LetterQueue /> : <ReportedGiftQueue />}
    </>
  );
}

function useQueue(url, key) {
  const [state, setState] = useState({ status: "loading", items: [] });
  const load = useCallback(async () => {
    const response = await fetch(url, { cache: "no-store" }).catch(() => null);
    const json = await response?.json().catch(() => ({}));
    if (!response?.ok) return setState({ status: "error", items: [], error: json?.error || "Could not load." });
    setState({ status: "ready", items: json[key] || [] });
  }, [url, key]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return [state, load];
}

function LetterQueue() {
  const [state, load] = useQueue("/api/admin/carnegie-letters", "letters");
  const [filter, setFilter] = useState("needs_review");
  const counts = Object.fromEntries(LETTER_STATUSES.map((status) => [status, state.items.filter((item) => item.status === status).length]));
  const shown = state.items.filter((item) => item.status === filter);
  return (
    <section className={styles.section} aria-label="Letters">
      <div className={styles.filters}>
        {LETTER_STATUSES.map((status) => (
          <button key={status} type="button" className={filter === status ? styles.chipActive : styles.chip} onClick={() => setFilter(status)} aria-pressed={filter === status}>
            {LETTER_STATUS_LABELS[status]} <span>{counts[status]}</span>
          </button>
        ))}
      </div>
      <p className={styles.rule}>Approve an exact version. Any edit after approval sends the letter back here. Nothing counts as delivered until someone reports it.</p>
      {state.status === "loading" ? <p className={styles.muted}>Loading…</p> : null}
      {state.status === "error" ? <p className={styles.error} role="alert">{state.error}</p> : null}
      {state.status === "ready" && !shown.length ? <p className={styles.muted}>No letters in this state.</p> : null}
      <div className={styles.list}>
        {shown.map((letter) => <LetterCard key={`${letter.id}-${letter.version}-${letter.status}`} letter={letter} reload={load} />)}
      </div>
    </section>
  );
}

function LetterCard({ letter, reload }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState("");
  const text = composeCarnegieLetter({
    recipientType: letter.recipient_type,
    recipientName: letter.recipient_name,
    meaningText: letter.meaning_text,
    helpText: letter.help_text,
    firstName: letter.student.firstName,
    code: letter.code
  });

  async function act(action, extra = {}) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/carnegie-letters/${letter.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: letter.version, ...extra })
    }).catch(() => null);
    const json = await response?.json().catch(() => ({}));
    setBusy(false);
    if (!response?.ok) return setError(json?.error || "That did not save.");
    reload();
  }

  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>{letter.student.displayName} → {letter.recipient_type === "general_supporter" ? "General supporter" : letter.recipient_name}</p>
          <p className={styles.muted}>{recipientTypeLabel(letter.recipient_type)} · version {letter.version} · updated {when(letter.updated_at)}</p>
        </div>
        <span className={styles[`status_${letter.status}`]}>{LETTER_STATUS_LABELS[letter.status]}</span>
      </header>
      <div className={styles.letterText}>
        <p>{text.greeting}</p>
        <p className={styles.fixed}>{text.opening}</p>
        <div className={styles.ownWords}>
          <p className={styles.ownLabel}>The student&apos;s own words, exactly as written</p>
          <p>{letter.meaning_text}</p>
          <p>{letter.help_text}</p>
        </div>
        <p className={styles.fixed}>{text.ask} {text.closing}</p>
        <p>{text.signoff} {text.signature}</p>
      </div>
      {letter.status === "needs_review" ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => act("approve")}>Approve version {letter.version} for print</button>
          {!returning ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => setReturning(true)}>Send back with a note</button> : null}
        </div>
      ) : null}
      {returning ? (
        <div className={styles.returnBox}>
          <label className={styles.field}>Note for the family
            <textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={busy || !note.trim()} onClick={() => act("return_to_draft", { note })}>Return to draft</button>
            <button type="button" className={styles.linkButton} onClick={() => setReturning(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {letterIsPrintable(letter) ? (
        <div className={styles.actions}>
          <a className={styles.secondaryLink} href={`/portal/carnegie-notes/packet/${letter.id}`}>Open print packet</a>
          {letter.status === "approved" ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => act("mark_printed")}>Mark printed</button> : null}
          {letter.status === "printed" ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => act("report_delivery")}>Record reported delivery</button> : null}
        </div>
      ) : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </article>
  );
}

function ReportedGiftQueue() {
  const [state, load] = useQueue("/api/admin/carnegie-reported-gifts", "reports");
  const waiting = state.items.filter((item) => item.status === "reported");
  const reviewed = state.items.filter((item) => item.status !== "reported");
  return (
    <section className={styles.section} aria-label="Reported gifts">
      <p className={styles.rule}>A reported gift counts nowhere until you confirm it. Confirming records one Carnegie gift for the student through the offline gift path, with a receipt if an email was given. Check the envelope first.</p>
      {state.status === "loading" ? <p className={styles.muted}>Loading…</p> : null}
      {state.status === "error" ? <p className={styles.error} role="alert">{state.error}</p> : null}
      {state.status === "ready" && !waiting.length ? <p className={styles.muted}>No reported gifts are waiting.</p> : null}
      <div className={styles.list}>
        {waiting.map((report) => <ReportCard key={report.id} report={report} reload={load} />)}
      </div>
      {reviewed.length ? (
        <>
          <h2 className={styles.subhead}>Reviewed</h2>
          <ul className={styles.history}>
            {reviewed.map((report) => (
              <li key={report.id}>
                <span>{report.student.displayName} · {report.donor_name} · reported {dollars(report.reported_amount_cents)} {report.reported_method}{report.status === "confirmed" ? `, confirmed ${dollars(report.confirmed_amount_cents)} ${report.confirmed_method}` : ""}</span>
                <span className={styles[`report_${report.status}`]}>{report.status === "rejected" ? `Rejected: ${report.reject_reason}` : REPORTED_GIFT_STATUS_LABELS[report.status]} · {when(report.reviewed_at)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function ReportCard({ report, reload }) {
  const [mode, setMode] = useState("");
  const [amount, setAmount] = useState(((report.reported_amount_cents || 0) / 100).toFixed(2));
  const [method, setMethod] = useState(report.reported_method);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(body) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/carnegie-reported-gifts/${report.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(() => null);
    const json = await response?.json().catch(() => ({}));
    setBusy(false);
    if (!response?.ok) return setError(json?.error || "That did not save.");
    reload();
  }

  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        <div>
          <p className={styles.cardTitle}>{report.student.displayName} · {dollars(report.reported_amount_cents)} {report.reported_method}{report.check_number ? ` #${report.check_number}` : ""}</p>
          <p className={styles.muted}>From {report.donor_name}{report.donor_email ? ` · receipt to ${report.donor_email}` : " · no receipt email"} · reported {when(report.created_at)}</p>
          {report.note ? <p className={styles.muted}>Note: {report.note}</p> : null}
        </div>
        <span className={styles.report_reported}>{REPORTED_GIFT_STATUS_LABELS.reported}</span>
      </header>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={busy} onClick={() => act({ action: "confirm" })}>Confirm as reported</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => setMode(mode === "adjust" ? "" : "adjust")}>Adjust, then confirm</button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => setMode(mode === "reject" ? "" : "reject")}>Reject</button>
      </div>
      {mode === "adjust" ? (
        <div className={styles.returnBox}>
          <div className={styles.row}>
            <label className={styles.field}>Amount in the envelope
              <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className={styles.field}>Method
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </select>
            </label>
          </div>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => act({ action: "confirm", amount, method })}>Confirm {amount ? `$${amount}` : ""} {method}</button>
        </div>
      ) : null}
      {mode === "reject" ? (
        <div className={styles.returnBox}>
          <label className={styles.field}>Reason (the family sees &quot;not confirmed; see Mr. Parker&quot;)
            <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="button" className={styles.secondary} disabled={busy || !reason.trim()} onClick={() => act({ action: "reject", reason })}>Reject this report</button>
        </div>
      ) : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </article>
  );
}
