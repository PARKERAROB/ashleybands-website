"use client";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, Notice, Field, Button } from "@/components/ui";
import { FIELDS, cleanAnswers } from "@/lib/seniorNight.mjs";
import styles from "./senior-night.module.css";

const EMPTY = Object.fromEntries(FIELDS.map((field) => [field.id, ""]));

export default function SeniorNightForm() {
  const [data, setData] = useState(null), [answers, setAnswers] = useState(EMPTY), [error, setError] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/portal/senior-night", { cache: "no-store" });
      if (response.status === 401) { window.location.replace("/portal?next=/portal/senior-night"); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setData(body); setAnswers({ ...EMPTY, ...body.answers });
    } catch (e) { setError(e.message || "Unable to load the form."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/portal/senior-night", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setData(body); setSaved(true);
    } catch (e) { setError(e.message || "Unable to save. Your answers are still here; please try again."); } finally { setSaving(false); }
  }
  return (
    <main className={styles.page}>
      <PageHeader title="Senior Night" lede="Friday, October 23. The announcer reads these answers as you walk out at the game. Check spelling carefully." />
      {loading ? <p role="status">Loading your form…</p> : data ? (
        <form onSubmit={save}>
          <p>Signed in as <strong>{data.name}</strong>. {data.updatedAt ? "Your answers are saved. You can change them and save again." : "Nothing saved yet."}</p>
          {FIELDS.map((field) => (
            <Field key={field.id} label={field.label} hint={field.hint} required={field.required}>
              {field.max > 160
                ? <textarea rows={3} maxLength={field.max} value={answers[field.id]} onChange={(e) => { setAnswers({ ...answers, [field.id]: e.target.value }); setSaved(false); }} />
                : <input maxLength={field.max} value={answers[field.id]} onChange={(e) => { setAnswers({ ...answers, [field.id]: e.target.value }); setSaved(false); }} />}
            </Field>
          ))}
          <div className={styles.actions}><Button type="submit" disabled={saving || !cleanAnswers(answers)}>{saving ? "Saving…" : "Save my answers"}</Button></div>
          {saved ? <Notice tone="success" title="Saved. Thank you!"><p>Mr. Parker will use these for the announcer script.</p></Notice> : null}
        </form>
      ) : <Button onClick={load}>Try again</Button>}
      {error ? <Notice tone="error" title="Something went wrong."><p>{error}</p></Notice> : null}
    </main>
  );
}
