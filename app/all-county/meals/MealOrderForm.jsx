"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Field, Notice, StatusChip } from "@/components/ui";
import { MEALS, MEAL_PAYEE, SCHOOL_SUGGESTIONS, formatCents, invoiceMeals, offeredMeals } from "@/lib/allCountyMeals.mjs";
import styles from "./meals.module.css";

const OPEN_MEALS = offeredMeals();
const ALL_OPEN = OPEN_MEALS.map((meal) => meal.key);
const blankStudent = () => ({ name: "", meals: [...ALL_OPEN] });
const EMPTY = { director_name: "", school: "", director_email: "", website: "" };

async function post(payload) {
  const response = await fetch("/api/all-county/meals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

export default function MealOrderForm({ open = true, closedMessage = "" }) {
  const params = useSearchParams();
  const linkToken = params.get("edit") || "";
  const [token, setToken] = useState(linkToken);
  const [form, setForm] = useState(EMPTY);
  const [students, setStudents] = useState([blankStudent()]);
  const [saved, setSaved] = useState(null); // { signup, invoice, emailed? }
  const [editing, setEditing] = useState(!linkToken);
  const [status, setStatus] = useState(linkToken ? "loading" : "idle");
  const [error, setError] = useState("");
  const savedToken = useRef(""); // the URL changes to this token after a save; do not reload it

  function fill(result) {
    setSaved(result);
    setForm({ ...EMPTY, director_name: result.signup.director_name, school: result.signup.school, director_email: result.signup.director_email });
    setStudents(result.signup.students.length ? result.signup.students.map((s) => ({ name: s.name, meals: [...s.meals] })) : [blankStudent()]);
  }

  useEffect(() => {
    if (!linkToken || linkToken === savedToken.current) return;
    let live = true;
    post({ action: "load", token: linkToken })
      .then((result) => { if (live) { fill(result); setStatus("idle"); } })
      .catch((e) => { if (live) { setError(e.message); setStatus("idle"); setEditing(true); setToken(""); } });
    return () => { live = false; };
  }, [linkToken]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setName = (index, name) => setStudents((list) => list.map((s, i) => (i === index ? { ...s, name } : s)));
  const toggle = (index, key) => setStudents((list) => list.map((s, i) => (i === index ? { ...s, meals: s.meals.includes(key) ? s.meals.filter((m) => m !== key) : [...s.meals, key] } : s)));
  const addNames = (names) => setStudents((list) => [...list.filter((s) => s.name.trim()), ...names.map((name) => ({ name, meals: [...ALL_OPEN] }))]);
  const remove = (index) => setStudents((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : [blankStudent()]));

  const preview = useMemo(() => {
    const named = students.filter((s) => s.name.trim());
    return { students: named.length, meals: named.reduce((sum, s) => sum + s.meals.length, 0) };
  }, [students]);

  async function submit(event) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const result = await post({ action: token ? "update" : "create", token: token || undefined, ...form, students });
      if (result.ok && !result.invoice) throw new Error("Please try again.");
      fill(result);
      setToken(result.editToken);
      savedToken.current = result.editToken;
      window.history.replaceState(null, "", `/all-county/meals?edit=${encodeURIComponent(result.editToken)}`);
      setEditing(false);
      window.scrollTo({ top: document.getElementById("meals-order")?.offsetTop || 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus("idle");
    }
  }

  if (status === "loading") return <p role="status">Loading your order…</p>;
  if (!open && !saved) {
    return (
      <div className={styles.stack}>
        <Notice tone="archived" title={closedMessage}>{error ? <p>{error}</p> : null}</Notice>
        <LostLink />
      </div>
    );
  }

  if (saved && !editing) {
    return (
      <div className={styles.stack}>
        {saved.emailed === true ? <Notice tone="success" title="Saved. Your invoice is below and on its way by email." role="status" /> : null}
        {saved.emailed === false ? (
          <Notice tone="info" title="Saved, but the email did not go out." role="status">
            <p>Your order is saved. Print this page or copy the edit link below.</p>
          </Notice>
        ) : null}
        <Invoice signup={saved.signup} invoice={saved.invoice} editToken={token} />
        {open && saved.open !== false
          ? <p><Button variant="secondary" onClick={() => setEditing(true)}>Add or remove students</Button></p>
          : <Notice tone="archived" title={closedMessage || "Changes are closed."} />}
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {token ? <Notice tone="info" title="You are changing a saved order."><p>Saving sends you an updated invoice. Remove a student to cancel their meals.</p></Notice> : null}
      <form className={styles.form} onSubmit={submit}>
        <Field label="Your name" required>
          <input value={form.director_name} onChange={set("director_name")} autoComplete="name" maxLength={120} />
        </Field>
        <Field label="School" hint="Start typing to pick your school." required>
          <input value={form.school} onChange={set("school")} list="allcounty-schools" autoComplete="organization" maxLength={120} />
        </Field>
        <datalist id="allcounty-schools">
          {SCHOOL_SUGGESTIONS.map((school) => <option key={school} value={school} />)}
        </datalist>
        <Field label="Your email" hint="We send the invoice and your edit link here." required>
          <input type="email" value={form.director_email} onChange={set("director_email")} autoComplete="email" maxLength={254} />
        </Field>

        <fieldset className={styles.students}>
          <legend>Students and meals</legend>
          <p className={styles.hint}>First and last name only. Uncheck any meal a student does not want.</p>
          <ol className={styles.studentList}>
            {students.map((student, index) => (
              <li key={index} className={styles.studentRow}>
                <label className={styles.nameLabel}>
                  <span className={styles.srOnly}>Student {index + 1} name</span>
                  <input value={student.name} onChange={(e) => setName(index, e.target.value)} placeholder={`Student ${index + 1} name`} autoComplete="off" maxLength={100} />
                </label>
                <div className={styles.mealChecks} role="group" aria-label={`Meals for student ${index + 1}`}>
                  {OPEN_MEALS.map((meal) => (
                    <label key={meal.key} className={styles.check}>
                      <input type="checkbox" checked={student.meals.includes(meal.key)} onChange={() => toggle(index, meal.key)} />
                      {meal.label}
                    </label>
                  ))}
                </div>
                <button type="button" className={styles.remove} onClick={() => remove(index)} aria-label={`Remove student ${index + 1}`}>
                  <X size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <p><Button type="button" variant="quiet" onClick={() => setStudents((list) => [...list, blankStudent()])}><Plus size={16} aria-hidden="true" /> Add a student</Button></p>
          <PasteNames onAdd={addNames} />
        </fieldset>

        <div className={styles.trap} aria-hidden="true">
          <label>Leave this blank<input value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" /></label>
        </div>

        <p className={styles.running} aria-live="polite">{preview.students} {preview.students === 1 ? "student" : "students"}, {preview.meals} {preview.meals === 1 ? "meal" : "meals"} so far.</p>
        {error ? <Notice tone="error" title={error} role="alert" /> : null}
        <div className={styles.actions}>
          <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : token ? "Save changes and update my invoice" : "Submit and get my invoice"}</Button>
          {saved ? <Button type="button" variant="quiet" onClick={() => { fill(saved); setEditing(false); setError(""); }}>Cancel changes</Button> : null}
        </div>
      </form>
      {!token ? <LostLink /> : null}
    </div>
  );
}

function Invoice({ signup, invoice, editToken }) {
  const shown = invoiceMeals(invoice, MEALS);
  const [copied, setCopied] = useState(false);
  const editLink = typeof window === "undefined" ? "" : `${window.location.origin}/all-county/meals?edit=${encodeURIComponent(editToken)}`;
  return (
    <article className={styles.invoice} aria-labelledby="invoice-title">
      <header className={styles.invoiceHead}>
        <h3 id="invoice-title">Invoice: {signup.school}</h3>
        <StatusChip status="needed">Payment due to the Band Boosters</StatusChip>
      </header>
      <p>Director: {signup.director_name} ({signup.director_email})</p>
      <div className={styles.tableWrap} role="region" aria-label="Invoice lines" tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Student</th>
              {shown.map((meal) => <th key={meal.key} scope="col">{meal.label}</th>)}
              <th scope="col" className={styles.end}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.length === 0 ? <tr><td colSpan={shown.length + 2}>No students on this order.</td></tr> : null}
            {invoice.lines.map((line) => (
              <tr key={line.name}>
                <th scope="row">{line.name}</th>
                {shown.map((meal) => <td key={meal.key}>{line.meals.includes(meal.key) ? "Yes" : ""}</td>)}
                <td className={styles.end}>{formatCents(line.amountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Meal count</th>
              {shown.map((meal) => <td key={meal.key}>{invoice.counts[meal.key]}</td>)}
              <td className={styles.end}>{formatCents(invoice.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={styles.total}>Total: {invoice.totalMeals} {invoice.totalMeals === 1 ? "meal" : "meals"} × {formatCents(invoice.priceCents)} = {formatCents(invoice.totalCents)}</p>
      <p>Collect from your students and give the Band Boosters one check or cash payment for {signup.school}. Make checks payable to {MEAL_PAYEE}, memo &ldquo;All-County meals, {signup.school}.&rdquo;</p>
      {editToken ? (
        <div className={styles.editLink}>
          <p><strong>Your private edit link.</strong> Keep it to add or remove students later. Do not share it.</p>
          <p className={styles.linkText}>{editLink}</p>
          <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(editLink).then(() => setCopied(true))}>{copied ? "Copied" : "Copy the link"}</Button>
        </div>
      ) : null}
    </article>
  );
}

// A long list is faster to paste than to type row by row. Each name starts with every meal checked.
function PasteNames({ onAdd }) {
  const [text, setText] = useState("");
  const names = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  return (
    <details className={styles.lost}>
      <summary>Have a list? Paste names</summary>
      <div className={styles.form}>
        <Field label="Student names" hint="One name per line, for example copied from a spreadsheet column.">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
        </Field>
        <p><Button type="button" variant="secondary" disabled={!names.length} onClick={() => { onAdd(names); setText(""); }}>Add {names.length || ""} {names.length === 1 ? "name" : "names"}</Button></p>
      </div>
    </details>
  );
}

function LostLink() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try { setMessage((await post({ action: "resend", email })).message); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <details className={styles.lost} id="lost-link">
      <summary>Already ordered? Get a new edit link</summary>
      <form onSubmit={send} className={styles.form}>
        <Field label="The email you ordered with" hint="We email a new link. Your old link stops working." required>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} />
        </Field>
        {message ? <Notice tone="success" title={message} role="status" /> : null}
        {error ? <Notice tone="error" title={error} role="alert" /> : null}
        <p><Button type="submit" variant="secondary" disabled={busy}>{busy ? "Sending…" : "Email me a new link"}</Button></p>
      </form>
    </details>
  );
}
