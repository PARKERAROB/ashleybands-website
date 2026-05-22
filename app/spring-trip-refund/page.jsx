"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// ============================================================================
// Submission gate.
// FORM_OPEN = false renders the full form for review but blocks all submission:
//   - the submit button is disabled
//   - a closed banner is shown
//   - the submit handler returns early and never calls the API
// To open the form later: set FORM_OPEN = true AND create the backend write
// path (api/spring-trip-refund/route.js + a Supabase table/RPC). Until that
// backend exists, opening this flag would still fail safely (no endpoint).
// ============================================================================
const FORM_OPEN = false;

const INITIAL_FORM = {
  student_first_name: "",
  student_last_name: "",
  guardian_name: "",
  guardian_email: "",
  guardian_phone: "",
  amount_paid: "",
  refund_choice: "",
  check_payable_to: "",
  check_delivery: "",
  mailing_address: "",
  hardship_full_refund: false,
  notes: "",
  deduction_acknowledgment: false,
  parent_signature: ""
};

function Field({ label, children, required = false }) {
  return (
    <label className="signup-field">
      <span>{label}{required ? " *" : ""}</span>
      {children}
    </label>
  );
}

function CheckField({ children, checked, onChange }) {
  return (
    <label className="signup-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

function SpringTripRefundInner() {
  const params = useSearchParams();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    student_first_name: params.get("first") || "",
    student_last_name: params.get("last") || "",
    guardian_email: params.get("email") || ""
  }));
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(
    () => FORM_OPEN && status !== "saving" && status !== "success",
    [status]
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!FORM_OPEN) {
      return;
    }
    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch("/api/spring-trip-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "The form did not submit.");
      }
      setStatus("success");
      setMessage("Your selection has been recorded. Mr. Parker will follow up if anything needs to be clarified.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "The form did not submit.");
    }
  }

  const wantsRefund = form.refund_choice === "refund";
  const wantsMail = wantsRefund && form.check_delivery === "mail";

  return (
    <main className="signup-page">
      <section className="signup-intro">
        <p className="eyebrow">Spring Trip 2026</p>
        <h1>Trip Refund Selection</h1>
        <p>
          The May 15 spring trip was cancelled. We have recovered the trip costs from the vendors, and
          we are returning the money families paid. This form lets each family tell us how they would
          like their refund handled.
        </p>
      </section>

      {!FORM_OPEN && (
        <div className="refund-banner" role="status">
          <strong>This form is not open yet.</strong> We are finishing the booster account reconciliation
          and waiting on the last vendor refunds to post. You do not need to do anything right now. We
          will email every family when the form opens. This page is a preview.
        </div>
      )}

      <form className="signup-form" onSubmit={submit}>
        <section className="signup-section">
          <h2>How Refunds Work</h2>
          <p>
            Each family gets back what they paid, minus a flat $20. The $20 covers the trip t-shirt your
            student keeps. So a family that paid the full $300 will receive $280 back.
          </p>
          <p>
            If the $20 is a hardship for your family, say so below and we will return the full amount. No
            explanation needed.
          </p>
        </section>

        <section className="signup-section">
          <h2>Student and Family</h2>
          <div className="signup-grid">
            <Field label="Student first name" required>
              <input value={form.student_first_name} onChange={(event) => update("student_first_name", event.target.value)} />
            </Field>
            <Field label="Student last name" required>
              <input value={form.student_last_name} onChange={(event) => update("student_last_name", event.target.value)} />
            </Field>
            <Field label="Parent/guardian name" required>
              <input value={form.guardian_name} onChange={(event) => update("guardian_name", event.target.value)} />
            </Field>
            <Field label="Parent/guardian email" required>
              <input type="email" value={form.guardian_email} onChange={(event) => update("guardian_email", event.target.value)} />
            </Field>
            <Field label="Parent/guardian phone" required>
              <input value={form.guardian_phone} onChange={(event) => update("guardian_phone", event.target.value)} />
            </Field>
            <Field label="Amount your family paid" required>
              <select value={form.amount_paid} onChange={(event) => update("amount_paid", event.target.value)}>
                <option value="">Select one</option>
                <option value="300">$300 (full payment)</option>
                <option value="200">$200 (partial)</option>
                <option value="150">$150 (partial)</option>
                <option value="other">Other / not sure</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="signup-section">
          <h2>Your Choice</h2>
          <p>Pick one of the three options below.</p>
          <div className="signup-options" aria-label="Refund choice">
            <label className="signup-check">
              <input
                type="radio"
                name="refund_choice"
                checked={form.refund_choice === "apply_mb_2026"}
                onChange={() => update("refund_choice", "apply_mb_2026")}
              />
              <span>Apply my refund to the 2026 marching band season (credit toward my student&rsquo;s season cost).</span>
            </label>
            <label className="signup-check">
              <input
                type="radio"
                name="refund_choice"
                checked={form.refund_choice === "refund"}
                onChange={() => update("refund_choice", "refund")}
              />
              <span>Refund the money to my family by check.</span>
            </label>
            <label className="signup-check">
              <input
                type="radio"
                name="refund_choice"
                checked={form.refund_choice === "donate"}
                onChange={() => update("refund_choice", "donate")}
              />
              <span>Donate my refund to the Ashley Band Boosters.</span>
            </label>
          </div>
        </section>

        {wantsRefund && (
          <section className="signup-section">
            <h2>Your Check</h2>
            <p>Refunds are paid by check from the booster account.</p>
            <div className="signup-grid">
              <Field label="Make the check payable to" required>
                <input value={form.check_payable_to} onChange={(event) => update("check_payable_to", event.target.value)} />
              </Field>
              <Field label="Pick up at the school or mail it?" required>
                <select value={form.check_delivery} onChange={(event) => update("check_delivery", event.target.value)}>
                  <option value="">Select one</option>
                  <option value="pickup">Hold at the school for pickup</option>
                  <option value="mail">Mail it to us</option>
                </select>
              </Field>
              {wantsMail && (
                <Field label="Mailing address" required>
                  <textarea value={form.mailing_address} onChange={(event) => update("mailing_address", event.target.value)} placeholder="Street, city, state, ZIP" />
                </Field>
              )}
            </div>
          </section>
        )}

        <section className="signup-section">
          <h2>Hardship and Acknowledgment</h2>
          <CheckField checked={form.hardship_full_refund} onChange={(event) => update("hardship_full_refund", event.target.checked)}>
            The $20 deduction would be a hardship for our family. Please refund the full amount we paid.
          </CheckField>
          <CheckField checked={form.deduction_acknowledgment} onChange={(event) => update("deduction_acknowledgment", event.target.checked)}>
            I understand $20 is retained to cover the trip t-shirt my student keeps, unless I marked the hardship box above.
          </CheckField>
          <Field label="Questions or notes">
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Anything you want to tell Mr. Parker about your refund." />
          </Field>
          <Field label="Parent/guardian signature (type your name)" required>
            <input value={form.parent_signature} onChange={(event) => update("parent_signature", event.target.value)} />
          </Field>
        </section>

        <div className="signup-submit">
          <button type="submit" disabled={!canSubmit}>
            {!FORM_OPEN ? "Not open yet" : status === "saving" ? "Submitting..." : status === "success" ? "Submitted" : "Submit selection"}
          </button>
          {message && <p className={status === "error" ? "signup-error" : "signup-success"}>{message}</p>}
        </div>
      </form>
    </main>
  );
}

export default function SpringTripRefundPage() {
  return (
    <Suspense fallback={<main className="signup-page"><p>Loading...</p></main>}>
      <SpringTripRefundInner />
    </Suspense>
  );
}
