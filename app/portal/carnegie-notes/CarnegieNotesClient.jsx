"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import NotesChart from "@/components/NotesChart";
import CarnegieBandProgress from "@/components/CarnegieBandProgress";
import {
  LETTER_STATUS_LABELS,
  NOTES_GOAL_CENTS,
  PUBLIC_SITE,
  REPORTED_GIFT_ENVELOPE_LINE,
  REPORTED_GIFT_STATUS_LABELS,
  pendingNotesLine,
  TRIP_ESTIMATE_LINE,
  carnegieShareText,
  letterIsPrintable,
  letterMailto,
  letterSendActions,
  smsHref,
  notesStatusLine,
  recipientTypeLabel
} from "@/lib/carnegieLetters.mjs";
import styles from "./notes.module.css";

const dollars = (cents) => `$${Math.round((Number(cents) || 0) / 100).toLocaleString("en-US")}`;
const linkCode = (student) => student?.link?.path?.split("/")[2] || "";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// The short fixed message. It needs no review because its wording never changes.
function ShareTextButton({ code, className, label = "Text it" }) {
  const [fallback, setFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = carnegieShareText(code);
  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    setFallback(true);
  }
  return (
    <>
      <button type="button" className={className} onClick={share}>{label}</button>
      {fallback ? (
        <span className={styles.shareFallback}>
          <a href={smsHref(text)}>Open my messages app</a>
          <button type="button" className={styles.linkButton} onClick={async () => setCopied(await copyText(text))}>{copied ? "Message copied" : "Copy the message"}</button>
        </span>
      ) : null}
    </>
  );
}

export default function CarnegieNotesClient({ previewMode = false }) {
  const [state, setState] = useState({ status: "loading" });
  const [selected, setSelected] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/carnegie-notes", { cache: "no-store" });
      if (response.status === 401) return setState({ status: "signed_out" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) return setState({ status: "error", error: json.error || "Your Carnegie notes could not be loaded." });
      setState({ status: "ready", students: json.students || [] });
      setSelected((current) => current || json.students?.[0]?.id || "");
    } catch {
      setState({ status: "error", error: "Your Carnegie notes could not be loaded." });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const student = state.students?.find((item) => item.id === selected) || null;

  return (
    <main className={styles.shell}>
      <div className={styles.wrap}>
        <div className={styles.topline}>
          <span className={styles.eyebrow}>Family Portal</span>
          {student ? <span className={styles.muted}>Private to {student.firstName}&apos;s family</span> : null}
        </div>
        <h1 className={styles.title}>{student ? `${student.firstName}'s Carnegie notes` : "My Carnegie notes"}</h1>
        {previewMode ? <p className={styles.preview}>Staff preview. Families cannot see this page yet.</p> : null}

        {state.status === "loading" ? <p className={styles.muted} role="status">Opening…</p> : null}
        {state.status === "signed_out" ? (
          <div className={styles.card}>
            <p>Sign in to your Family Portal first, then come back here.</p>
            <Link className={styles.primary} href="/portal">Go to the Family Portal</Link>
          </div>
        ) : null}
        {state.status === "error" ? <p className={styles.error} role="alert">{state.error}</p> : null}
        {state.status === "ready" && !state.students.length ? (
          <div className={styles.card}><p>We could not find a current band student on your portal profile.</p></div>
        ) : null}

        {state.students?.length > 1 ? (
          <div className={styles.tabs} role="tablist" aria-label="Choose a student">
            {state.students.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={item.id === selected}
                className={item.id === selected ? styles.tabActive : styles.tab} onClick={() => setSelected(item.id)}>
                {item.firstName}
              </button>
            ))}
          </div>
        ) : null}

        {student ? <StudentNotes student={student} reload={load} /> : null}
      </div>
    </main>
  );
}

function StudentNotes({ student, reload }) {
  const [copied, setCopied] = useState(false);
  const full = student.link ? `https://${PUBLIC_SITE}${student.link.path}` : "";
  const printable = student.letters.filter(letterIsPrintable);

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="notes-heading">
        <h2 id="notes-heading" className={styles.srOnly}>Music notes</h2>
        <div className={styles.amountRow}>
          <span className={styles.amount}>{dollars(student.notesCents)}</span>
          <span className={styles.of}>of my {dollars(NOTES_GOAL_CENTS)}</span>
        </div>
        <NotesChart className={styles.chart} confirmedCents={student.notesCents} pendingCents={student.pendingCents} />
        <p className={student.notesCents >= NOTES_GOAL_CENTS ? styles.filled : styles.muted}>{notesStatusLine(student.notesCents)}</p>
        {student.pendingCents ? (
          <p className={styles.pendingLine}><span className={styles.pendingSwatch} aria-hidden="true" />{pendingNotesLine(student.pendingCents)}</p>
        ) : null}
        <dl className={styles.lines}>
          <div><dt>Deposit paid</dt><dd>{student.depositPaidCents ? dollars(student.depositPaidCents) : "Not recorded yet"}</dd></div>
          <div><dt>Raised through my notes</dt><dd>{dollars(student.notesCents)}</dd></div>
        </dl>
      </section>

      {student.link ? (
        <section className={styles.linkCard} aria-labelledby="link-heading">
          <div className={styles.qr}><QRCodeSVG value={full} size={88} level="M" marginSize={1} /></div>
          <div className={styles.linkBody}>
            <h2 id="link-heading" className={styles.linkLabel}>My Carnegie link</h2>
            <p className={styles.linkUrl}>{student.link.readable}</p>
            <div className={styles.linkButtons}>
              <button type="button" className={styles.gold} onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              <ShareTextButton code={linkCode(student)} className={styles.goldOutline} label="Text my link" />
            </div>
            <span className={styles.srOnly} aria-live="polite">{copied ? "Link copied" : ""}</span>
          </div>
        </section>
      ) : null}

      <div className={styles.actions}>
        <Link className={styles.outline} href={`/portal/carnegie-notes/letter?student=${student.id}`}>Write a letter</Link>
        {printable.length ? (
          <Link className={styles.outline} href={`/portal/carnegie-notes/packet/${printable[0].id}`}>Print my packet</Link>
        ) : (
          <span className={styles.outlineDisabled} aria-disabled="true">Print my packet</span>
        )}
      </div>
      {!printable.length ? <p className={styles.hint}>Your packet is ready to print once a letter is approved.</p> : null}

      <ReportGift student={student} reload={reload} />

      <section className={styles.card} aria-labelledby="letters-heading">
        <h2 id="letters-heading" className={styles.cardTitle}>My letters</h2>
        {student.letters.length ? (
          <ul className={styles.letters}>
            {student.letters.map((letter) => <LetterRow key={letter.id} letter={letter} student={student} reload={reload} />)}
          </ul>
        ) : <p className={styles.muted}>No letters yet. Write one to someone who would love to hear from you.</p>}
      </section>

      <section className={styles.card}>
        <CarnegieBandProgress>
          <p className={styles.muted}>{TRIP_ESTIMATE_LINE}</p>
        </CarnegieBandProgress>
      </section>
    </div>
  );
}

function LetterRow({ letter, student, reload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const who = letter.recipient_type === "general_supporter" ? "Any supporter" : letter.recipient_name || "Someone I know";
  const code = linkCode(student);
  const actions = code ? letterSendActions(letter) : [];
  const mail = actions.includes("email") ? letterMailto(letter, { firstName: student.firstName, code }) : null;

  async function reportSent(channel) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/portal/carnegie-notes/letters/${letter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report_delivery", version: letter.version, channel })
    }).catch(() => null);
    const json = await response?.json().catch(() => ({}));
    setBusy(false);
    if (!response?.ok) return setError(json?.error || "That did not save. Try again.");
    reload();
  }

  return (
    <li className={styles.letterRow}>
      <div className={styles.letterMain}>
        <span className={styles.letterWho}>{who} · {recipientTypeLabel(letter.recipient_type)}</span>
        <span className={styles[`status_${letter.status}`] || styles.status}>{LETTER_STATUS_LABELS[letter.status]}{letter.status === "delivery_reported" && letter.delivery_channel ? ` · ${letter.delivery_channel}` : ""}</span>
      </div>
      {letter.status === "draft" && letter.review_note ? <p className={styles.note}>Note from the band staff: {letter.review_note}</p> : null}
      <div className={styles.letterLinks}>
        {letter.status !== "delivery_reported" ? <Link href={`/portal/carnegie-notes/letter?id=${letter.id}`}>{letter.status === "draft" ? "Keep writing" : "View or edit"}</Link> : null}
      </div>
      {actions.length ? (
        <div className={styles.sendRow} aria-label="Send this letter">
          <a className={styles.sendButton} href={mail.href}>Email it</a>
          <ShareTextButton code={code} className={styles.sendButton} />
          <Link className={styles.sendButton} href={`/portal/carnegie-notes/packet/${letter.id}`}>Print it</Link>
          <button type="button" className={styles.linkButton} onClick={async () => setCopied(await copyText(mail.text))}>{copied ? "Letter copied" : "Copy letter"}</button>
        </div>
      ) : null}
      {mail && !mail.fits ? <p className={styles.hint}>This letter is long for some mail apps. Tap Copy letter first, then paste it into the email.</p> : null}
      {actions.includes("report_sent") ? (
        <div className={styles.sentRow}>
          <span>I sent it by</span>
          {["paper", "email", "text"].map((channel) => (
            <button key={channel} type="button" className={styles.chipButton} disabled={busy} onClick={() => reportSent(channel)}>{channel}</button>
          ))}
        </div>
      ) : null}
      {letter.status === "needs_review" ? <p className={styles.hint}>Email and print open after band staff approve the letter. You can text your link any time.</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </li>
  );
}

const dollarsCents = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: (Number(cents) || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const EMPTY_REPORT = { donor_name: "", amount: "", method: "", check_number: "", donor_email: "", note: "" };

function ReportGift({ student, reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const reports = student.reportedGifts || [];

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/portal/carnegie-notes/reported-gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: student.id, ...form })
    }).catch(() => null);
    const json = await response?.json().catch(() => ({}));
    setBusy(false);
    if (!response?.ok) return setError(json?.error || "That did not save. Try again.");
    setForm(EMPTY_REPORT);
    setOpen(false);
    setDone(true);
    reload();
  }

  return (
    <section className={styles.card} aria-labelledby="report-heading">
      <div className={styles.reportHead}>
        <h2 id="report-heading" className={styles.cardTitle}>Gifts I collected</h2>
        {!open ? <button type="button" className={styles.secondarySmall} onClick={() => { setOpen(true); setDone(false); }}>Report a gift I collected</button> : null}
      </div>
      <p className={styles.envelope}>{REPORTED_GIFT_ENVELOPE_LINE}</p>
      {done ? <p className={styles.filled} role="status">Thank you. Staff will confirm it when the envelope arrives, and then your notes fill in.</p> : null}
      {open ? (
        <form className={styles.reportForm} onSubmit={submit}>
          <label className={styles.field}>Who gave it?
            <input value={form.donor_name} required maxLength={160} autoComplete="off" onChange={(event) => update("donor_name", event.target.value)} />
          </label>
          <label className={styles.field}>Amount
            <input value={form.amount} required inputMode="decimal" placeholder="$" onChange={(event) => update("amount", event.target.value)} />
          </label>
          <fieldset className={styles.methods}>
            <legend>Cash or check?</legend>
            {["cash", "check"].map((method) => (
              <label key={method} className={form.method === method ? styles.methodActive : styles.method}>
                <input type="radio" name="method" value={method} checked={form.method === method} onChange={() => update("method", method)} />
                {method === "cash" ? "Cash" : "Check"}
              </label>
            ))}
          </fieldset>
          {form.method === "check" ? (
            <label className={styles.field}>Check number, if you know it
              <input value={form.check_number} maxLength={40} inputMode="numeric" onChange={(event) => update("check_number", event.target.value)} />
            </label>
          ) : null}
          <label className={styles.field}>Their email, for a receipt (optional)
            <input type="email" value={form.donor_email} maxLength={254} autoComplete="off" onChange={(event) => update("donor_email", event.target.value)} />
          </label>
          <label className={styles.field}>Note (optional)
            <input value={form.note} maxLength={500} onChange={(event) => update("note", event.target.value)} />
          </label>
          <p className={styles.formNote}>This tells staff to look for the envelope. The gift shows as waiting until staff confirm it. No receipt goes out before then.</p>
          <div className={styles.buttons}>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Report this gift"}</button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => { setOpen(false); setForm(EMPTY_REPORT); setError(""); }}>Cancel</button>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </form>
      ) : null}
      {reports.length ? (
        <ul className={styles.letters}>
          {reports.map((report) => (
            <li key={report.id} className={styles.letterRow}>
              <div className={styles.letterMain}>
                <span className={styles.letterWho}>{report.donor_name} · {dollarsCents(report.status === "confirmed" ? report.confirmed_amount_cents : report.reported_amount_cents)} {report.status === "confirmed" ? report.confirmed_method : report.reported_method}</span>
                <span className={styles[`report_${report.status}`]}>{REPORTED_GIFT_STATUS_LABELS[report.status]}</span>
              </div>
              {report.status === "confirmed" && report.confirmed_amount_cents !== report.reported_amount_cents ? <p className={styles.muted}>You reported {dollarsCents(report.reported_amount_cents)}; staff confirmed {dollarsCents(report.confirmed_amount_cents)}.</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
