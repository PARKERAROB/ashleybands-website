"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LETTER_LIMITS,
  LETTER_PROMPTS,
  LETTER_STATUS_LABELS,
  RECIPIENT_TYPES,
  composeCarnegieLetter
} from "@/lib/carnegieLetters.mjs";
import styles from "../notes.module.css";

const EMPTY = { recipient_type: "someone_i_know", recipient_name: "", recipient_email: "", meaning_text: "", help_text: "" };

export default function LetterBuilderClient({ previewMode = false }) {
  const params = useSearchParams();
  const router = useRouter();
  const letterId = params.get("id") || "";
  const studentParam = params.get("student") || "";
  const [load, setLoad] = useState({ status: "loading" });
  const [letter, setLetter] = useState(null);
  const [student, setStudent] = useState(null);
  const [code, setCode] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function open() {
      try {
        if (letterId) {
          const response = await fetch(`/api/portal/carnegie-notes/letters/${letterId}`, { cache: "no-store" });
          if (response.status === 401) return !cancelled && setLoad({ status: "signed_out" });
          const json = await response.json().catch(() => ({}));
          if (!response.ok) return !cancelled && setLoad({ status: "error", error: json.error || "This letter could not be opened." });
          if (cancelled) return;
          setLetter(json.letter);
          setStudent(json.student);
          setCode(json.code);
          setForm({ recipient_type: json.letter.recipient_type, recipient_name: json.letter.recipient_name, recipient_email: json.letter.recipient_email || "", meaning_text: json.letter.meaning_text, help_text: json.letter.help_text });
          setLoad({ status: "ready" });
          return;
        }
        const response = await fetch("/api/portal/carnegie-notes", { cache: "no-store" });
        if (response.status === 401) return !cancelled && setLoad({ status: "signed_out" });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return !cancelled && setLoad({ status: "error", error: json.error || "This page could not be opened." });
        const match = (json.students || []).find((item) => item.id === studentParam) || (json.students || [])[0];
        if (cancelled) return;
        if (!match) return setLoad({ status: "error", error: "We could not find a current band student on your portal profile." });
        setStudent({ id: match.id, firstName: match.firstName });
        setCode(match.link?.path?.split("/")[2] || null);
        setLoad({ status: "ready" });
      } catch {
        if (!cancelled) setLoad({ status: "error", error: "This page could not be opened." });
      }
    }
    open();
    return () => { cancelled = true; };
  }, [letterId, studentParam]);

  const status = letter?.status || "draft";
  const locked = status === "delivery_reported";
  const approvedBefore = status === "approved" || status === "printed";
  const complete = Boolean(form.meaning_text.trim() && form.help_text.trim() && (form.recipient_type === "general_supporter" || form.recipient_name.trim()));
  const step = letter && status !== "draft" ? 4 : complete ? 3 : form.meaning_text || form.help_text ? 2 : 1;
  const preview = useMemo(() => composeCarnegieLetter({
    recipientType: form.recipient_type,
    recipientName: form.recipient_name,
    meaningText: form.meaning_text,
    helpText: form.help_text,
    firstName: student?.firstName,
    code
  }), [form, student, code]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage("");
  }

  async function send(action) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let current = letter;
      if (!current) {
        const created = await fetch("/api/portal/carnegie-notes/letters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: student.id, ...form })
        });
        const json = await created.json().catch(() => ({}));
        if (!created.ok) throw new Error(json.error || "The letter could not be saved.");
        current = json.letter;
        setLetter(current);
        router.replace(`/portal/carnegie-notes/letter?id=${current.id}`, { scroll: false });
        if (action === "save") {
          setDirty(false);
          setMessage("Draft saved. You can come back to it any time.");
          return;
        }
      }
      const response = await fetch(`/api/portal/carnegie-notes/letters/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: current.version, ...form })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || "The letter could not be saved.");
      setLetter(json.letter);
      setDirty(false);
      setMessage(action === "submit"
        ? "Sent for review. Band staff will check it before it can be printed."
        : json.letter.status === "needs_review" && approvedBefore
          ? "Saved. Because it changed, it goes back for review before printing."
          : "Saved.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (load.status === "loading") return <Shell previewMode={previewMode}><p className={styles.muted} role="status">Opening…</p></Shell>;
  if (load.status === "signed_out") return <Shell previewMode={previewMode}><div className={styles.card}><p>Sign in to your Family Portal first, then come back here.</p><Link className={styles.primary} href="/portal">Go to the Family Portal</Link></div></Shell>;
  if (load.status === "error") return <Shell previewMode={previewMode}><p className={styles.error} role="alert">{load.error}</p><Link href="/portal/carnegie-notes">Back to my notes</Link></Shell>;

  return (
    <Shell previewMode={previewMode} wide>
      <ol className={styles.steps} aria-label="Letter steps">
        {["Recipient", "Your words", "Review", "Staff check, then print"].map((label, index) => (
          <li key={label} className={step === index + 1 ? styles.stepActive : styles.step} aria-current={step === index + 1 ? "step" : undefined}>{index + 1} {label}</li>
        ))}
      </ol>
      {letter ? <p className={styles.muted}>Status: <strong>{LETTER_STATUS_LABELS[status]}</strong></p> : null}
      {status === "draft" && letter?.review_note ? <p className={styles.note}>Note from the band staff: {letter.review_note}</p> : null}

      <div className={styles.builder}>
        <form className={styles.stack} onSubmit={(event) => event.preventDefault()}>
          <fieldset className={styles.types} disabled={locked || Boolean(letter)}>
            <legend>Who are you writing to?</legend>
            {RECIPIENT_TYPES.map((type) => (
              <button key={type.value} type="button" disabled={!type.enabled}
                className={!type.enabled ? styles.typeDisabled : form.recipient_type === type.value ? styles.typeActive : styles.type}
                aria-pressed={form.recipient_type === type.value}
                onClick={() => type.enabled && update("recipient_type", type.value)}>
                <span className={styles.typeName}>{type.label}</span>
                <span className={styles.typeHint}>{type.hint}</span>
              </button>
            ))}
          </fieldset>

          {form.recipient_type === "someone_i_know" ? (
            <label className={styles.field}>Their name, the way you would greet them
              <input value={form.recipient_name} maxLength={LETTER_LIMITS.recipientName} disabled={locked}
                placeholder="Aunt Lee" onChange={(event) => update("recipient_name", event.target.value)} />
              <span className={styles.formNote}>Only your family and band staff can see this name.</span>
            </label>
          ) : null}
          {form.recipient_type === "someone_i_know" ? (
            <label className={styles.field}>Their email (optional)
              <input type="email" value={form.recipient_email} maxLength={254} disabled={locked} autoComplete="off"
                onChange={(event) => update("recipient_email", event.target.value)} />
              <span className={styles.formNote}>Only used to fill in the To line when you email the approved letter from your own mail app. The website never emails them.</span>
            </label>
          ) : null}

          <label className={styles.field}>{LETTER_PROMPTS.meaning}
            <textarea value={form.meaning_text} maxLength={LETTER_LIMITS.meaning} disabled={locked}
              placeholder="A proud moment, a friend you made, something you learned…"
              onChange={(event) => update("meaning_text", event.target.value)} />
            <span className={styles.counter}>{form.meaning_text.length} / {LETTER_LIMITS.meaning}</span>
          </label>
          <label className={styles.field}>{LETTER_PROMPTS.help}
            <textarea value={form.help_text} maxLength={LETTER_LIMITS.help} disabled={locked}
              onChange={(event) => update("help_text", event.target.value)} />
            <span className={styles.counter}>{form.help_text.length} / {LETTER_LIMITS.help}</span>
          </label>
          <p className={styles.formNote}>Your words stay yours. We print them exactly as you write them. You don&apos;t have to be going on the trip to write one. Band grades never depend on this.</p>

          {locked ? <p className={styles.muted}>This letter was delivered, so it can no longer change.</p> : (
            <div className={styles.buttons}>
              {status === "draft" ? (
                <>
                  <button type="button" className={styles.secondary} disabled={busy} onClick={() => send("save")}>Save draft</button>
                  <button type="button" className={styles.primary} disabled={busy || !complete} onClick={() => send("submit")}>Send for review</button>
                </>
              ) : (
                <button type="button" className={styles.primary} disabled={busy || !dirty} onClick={() => send("save")}>Save changes</button>
              )}
              <span className={styles.saveState} aria-live="polite">{busy ? "Saving…" : dirty ? "Unsaved changes" : message}</span>
            </div>
          )}
          {approvedBefore && !locked ? <p className={styles.formNote}>This letter is approved. Saving a change sends it back for review before it can be printed again.</p> : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <p className={styles.muted}><Link href="/portal/carnegie-notes">Back to my notes</Link></p>
        </form>

        <section className={styles.letterPreview} aria-label="Live preview of the whole letter">
          <p className={styles.previewLabel}>Live preview · the whole letter</p>
          <p className={styles.previewText}>{preview.greeting}</p>
          <p className={styles.previewText}>{preview.opening}</p>
          <div className={styles.ownWords}>
            <p className={styles.previewLabel}>{preview.ownWordsLabel}</p>
            <p className={`${styles.previewText} ${preview.meaning ? "" : styles.placeholder}`}>{preview.meaning || "Your answer to the first question appears here as you type."}</p>
            <p className={`${styles.previewText} ${preview.help ? "" : styles.placeholder}`}>{preview.help || "Your answer to the second question appears here."}</p>
          </div>
          <p className={styles.previewText}>{preview.ask}</p>
          <p className={styles.previewText}>{preview.closing}</p>
          <p className={styles.previewText}>{preview.signoff}<br /><span className={styles.signature}>{preview.signature}</span></p>
          <p className={styles.previewFoot}><strong>{preview.url}</strong><br />{preview.payLine}<br />{preview.campaignLine}</p>
          <p className={styles.previewFoot}>Back page: your music notes chart and QR code.</p>
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children, previewMode, wide = false }) {
  return (
    <main className={styles.shell}>
      <div className={`${styles.wrap} ${wide ? styles.wide : ""}`}>
        <span className={styles.eyebrow}>Write a Carnegie letter</span>
        <h1 className={styles.title}>A letter in your own words</h1>
        {previewMode ? <p className={styles.preview}>Staff preview. Families cannot see this page yet.</p> : null}
        {children}
      </div>
    </main>
  );
}
