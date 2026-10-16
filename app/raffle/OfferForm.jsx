"use client";

import { useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import styles from "./raffle.module.css";

const EMPTY = { donor_name: "", business_name: "", contact: "", prize_description: "", estimated_value: "", website: "" };

export default function OfferForm() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/raffle/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "We could not save your offer. Please try again.");
      setForm(EMPTY);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <Notice tone="success" title="Thank you. We have your offer." role="status">
        <p>Someone from the Band Boosters will contact you about the details.</p>
        <p><Button variant="quiet" onClick={() => setStatus("idle")}>Offer another prize</Button></p>
      </Notice>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Field label="Your name" required>
        <input value={form.donor_name} onChange={set("donor_name")} autoComplete="name" maxLength={200} />
      </Field>
      <Field label="Business" hint="Leave blank if the prize is from you or your family.">
        <input value={form.business_name} onChange={set("business_name")} autoComplete="organization" maxLength={200} />
      </Field>
      <Field label="Email or phone" hint="So we can reach you about the prize." required>
        <input value={form.contact} onChange={set("contact")} autoComplete="email" minLength={3} maxLength={200} />
      </Field>
      <Field label="What is the prize or experience?" required>
        <textarea value={form.prize_description} onChange={set("prize_description")} maxLength={2000} />
      </Field>
      <Field label="Estimated value" hint="A rough dollar amount is fine. Each prize must be worth less than $2,000." required>
        <input value={form.estimated_value} onChange={set("estimated_value")} inputMode="decimal" maxLength={50} />
      </Field>
      <div className={styles.trap} aria-hidden="true">
        <label>
          Leave this blank
          <input value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error ? <Notice tone="error" title={error} role="alert" /> : null}
      <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Sending…" : "Send my offer"}</Button>
    </form>
  );
}
