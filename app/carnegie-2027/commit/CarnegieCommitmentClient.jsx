"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CARNEGIE_AMOUNT_BANDS,
  CARNEGIE_HELP_OPTIONS,
  CARNEGIE_RESPONSE_OPTIONS,
  carnegieResponseLabel,
} from "@/lib/carnegieTripConstants";
import styles from "./carnegie-commitment.module.css";

let paypalSdkPromise;
function loadPaypalSdk(clientId) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("Could not load PayPal."));
    document.body.appendChild(script);
  });
  return paypalSdkPromise;
}

const initialFields = {
  studentFirst: "",
  studentLast: "",
  schoolEmail: "",
  guardianName: "",
  guardianEmail: "",
  guardianPhone: "",
  response: "serious_yes",
  maximumFamilyAmountBand: "",
  helpOptions: [],
  guardianSignature: "",
  studentSignature: "",
  termsAccepted: false,
};

export default function CarnegieCommitmentClient({ portalMode = false }) {
  const [fields, setFields] = useState(initialFields);
  const [portalData, setPortalData] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(portalMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const submissionKey = useRef("");
  const paypalRef = useRef(null);

  useEffect(() => {
    if (!portalMode) return;
    let cancelled = false;
    fetch("/api/carnegie-2027/me")
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Could not open this commitment in the Family Portal.");
        if (cancelled) return;
        setPortalData(body);
        const requested = new URLSearchParams(window.location.search).get("studentId") || "";
        const selected = body.students?.find((student) => student.id === requested) || body.students?.[0];
        setStudentId(selected?.id || "");
        setResult(selected?.status || null);
        setFields((current) => ({ ...current, guardianName: body.guardian?.name || "", guardianEmail: body.guardian?.email || "" }));
      })
      .catch((caught) => !cancelled && setError(caught.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [portalMode]);

  function update(field, value) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function toggleHelp(value) {
    setFields((current) => ({
      ...current,
      helpOptions: current.helpOptions.includes(value)
        ? current.helpOptions.filter((option) => option !== value)
        : [...current.helpOptions, value],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setPaymentMessage("");
    if (!submissionKey.current) submissionKey.current = window.crypto.randomUUID();
    try {
      const response = await fetch("/api/carnegie-2027/commitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, ...(portalMode ? { studentId } : {}), submissionKey: submissionKey.current }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The commitment could not be saved.");
      setResult(body);
      submissionKey.current = "";
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function showPayment() {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId || !result?.checkoutToken) {
      setPaymentMessage("Online payment is not available right now. Your commitment and $50 ledger charge are saved; staff can help you finish payment.");
      return;
    }
    setPaymentMessage("Opening secure payment…");
    try {
      const paypal = await loadPaypalSdk(clientId);
      paypalRef.current.innerHTML = "";
      await paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "pay" },
        createOrder: async () => {
          const response = await fetch("/api/carnegie-2027/payment/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkoutToken: result.checkoutToken }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || "Could not start payment.");
          return body.orderId;
        },
        onApprove: async (data) => {
          setPaymentMessage("Confirming the payment in the AshleyBands ledger…");
          const response = await fetch("/api/carnegie-2027/payment/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: data.orderID, checkoutToken: result.checkoutToken }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || "Payment could not be confirmed.");
          setResult((current) => ({ ...current, paid: true, checkoutToken: "", invoiceId: body.invoiceId }));
          setPaymentMessage("Payment received. The $50 deposit is now visible in the family and staff financial records.");
          paypalRef.current.innerHTML = "";
        },
        onCancel: () => setPaymentMessage("Payment was cancelled. Your commitment is saved and the $50 balance remains available in the Family Portal."),
        onError: (caught) => setPaymentMessage(caught?.message || "PayPal could not complete the payment. Your commitment is still saved."),
      }).render(paypalRef.current);
      setPaymentMessage("");
    } catch (caught) {
      setPaymentMessage(caught.message || "Could not open PayPal. Your commitment is still saved.");
    }
  }

  const selectedStudent = portalData?.students?.find((student) => student.id === studentId);
  const responseLabel = result ? carnegieResponseLabel(result.response) : "";

  if (loading) return <main className={styles.page}><section className={styles.card}><p>Opening the Carnegie commitment…</p></section></main>;

  if (portalMode && error && !portalData) return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>Ashley Bands Family Portal</p><h1>Sign in to continue.</h1><p>{error} You can sign in and return here, or use the public commitment form without signing in.</p><div className={styles.actions}><Link href="/portal?next=%2Fportal%2Fcarnegie-2027">Sign in to Family Portal</Link><Link href="/carnegie-2027/commit">Use the public form</Link></div></section></main>;

  if (portalMode && result?.source === "staff_verbal") return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>Carnegie Hall 2027</p><h1>A verbal response is on file.</h1><p>Staff recorded this as an unsigned fallback for {selectedStudent?.displayName || "this student"}. Complete the acknowledgement and typed signatures now; then a serious “yes” can continue to the connected $50 payment.</p><div className={styles.actions}><button className={styles.primaryButton} type="button" onClick={() => { setFields((current) => ({ ...current, response: result.response, maximumFamilyAmountBand: result.maximumFamilyAmountBand || "" })); setResult(null); }}>Complete and sign this response</button><Link href="/portal/review">Return to Family Portal</Link></div></section></main>;

  if (result) {
    return (
      <main className={styles.page}>
        <section className={`${styles.card} ${styles.confirmation}`}>
          <p className={styles.eyebrow}>Carnegie Hall 2027</p>
          <h1>Your response is saved.</h1>
          <p><strong>{responseLabel}</strong>{result.studentName ? ` for ${result.studentName}` : selectedStudent ? ` for ${selectedStudent.displayName}` : ""}.</p>
          {result.response === "serious_yes" ? (
            result.paid ? (
              <div className={styles.success}><strong>$50 received</strong><span>The payment is connected to the AshleyBands family financial ledger.</span></div>
            ) : (
              <div className={styles.paymentPanel}>
                <span>Conditional deposit</span><strong>$50</strong>
                <p>Refundable until the participation threshold is confirmed and Ashley Bands pays the WorldStrides group deposit. If an unapproved Concert Band student pays, the $50 will be refunded.</p>
                <button className={styles.primaryButton} type="button" onClick={showPayment}>Pay the $50 deposit now</button>
                <div className={styles.paypal} ref={paypalRef} />
                {paymentMessage ? <p className={styles.message} role="status">{paymentMessage}</p> : null}
              </div>
            )
          ) : (
            <p className={styles.notice}>No payment is due for this response. Thank you for giving Ashley Bands clear planning information.</p>
          )}
          <div className={styles.actions}>
            {portalMode ? <Link href="/portal/review">Return to Family Portal</Link> : <Link href="/portal">Open Family Portal</Link>}
            <button type="button" className={styles.textButton} onClick={() => { setResult(null); setPaymentMessage(""); }}>Update this response</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Ashley Bands · Carnegie Hall 2027</p>
        <h1>Family commitment</h1>
        <p>Submit one response per student by Friday, September 4. A serious “yes” creates the connected $50 conditional-deposit charge and lets you pay it immediately.</p>
        <p className={styles.portalOption}><Link href="/carnegie-2027/meeting-packet">Read the complete family meeting packet</Link>{!portalMode ? <> or <Link href="/portal/carnegie-2027">open the connected Family Portal version</Link></> : null}.</p>
      </header>

      <form className={styles.form} onSubmit={submit}>
        {portalMode ? (
          <fieldset>
            <legend>Student</legend>
            {!portalData?.students?.length ? <p>No Carnegie-eligible student is connected to this account. <Link href="/portal/request?next=%2Fportal%2Fcarnegie-2027">Request access</Link> or use the public form.</p> : (
              <label className={styles.field}>Submitting for<select value={studentId} onChange={(event) => { const nextId = event.target.value; setStudentId(nextId); setResult(portalData.students.find((student) => student.id === nextId)?.status || null); }} required>{portalData.students.map((student) => <option key={student.id} value={student.id}>{student.displayName} · {student.ensemble}</option>)}</select></label>
            )}
          </fieldset>
        ) : (
          <fieldset>
            <legend>Connect this response to the student</legend>
            <p>Use the student&apos;s exact roster name and NHCS student email. The form never displays or searches the roster.</p>
            <div className={styles.grid}>
              <label className={styles.field}>Student first name<input value={fields.studentFirst} onChange={(event) => update("studentFirst", event.target.value)} autoComplete="given-name" required /></label>
              <label className={styles.field}>Student last name<input value={fields.studentLast} onChange={(event) => update("studentLast", event.target.value)} autoComplete="family-name" required /></label>
            </div>
            <label className={styles.field}>Student NHCS email<input type="email" value={fields.schoolEmail} onChange={(event) => update("schoolEmail", event.target.value)} placeholder="student@student.nhcs.net" required /></label>
          </fieldset>
        )}

        <fieldset>
          <legend>Your family&apos;s response</legend>
          <p>The trip is currently planning around $2,500 per traveler. Ashley Bands will not ask a participating family to pay more than $2,000 under this commitment, and our goal is to reduce that family total substantially through outside support.</p>
          {CARNEGIE_RESPONSE_OPTIONS.map((option) => (
            <label className={`${styles.choice} ${fields.response === option.value ? styles.selected : ""}`} key={option.value}>
              <input type="radio" name="response" value={option.value} checked={fields.response === option.value} onChange={() => update("response", option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
          {fields.response === "interested_limited" ? (
            <label className={styles.field}>Highest family amount we can responsibly plan for<select value={fields.maximumFamilyAmountBand} onChange={(event) => update("maximumFamilyAmountBand", event.target.value)} required><option value="">Choose a range</option>{CARNEGIE_AMOUNT_BANDS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Ways your family may be able to help</legend>
          <p>Optional. Check everything that applies.</p>
          {CARNEGIE_HELP_OPTIONS.map((option) => <label className={styles.check} key={option.value}><input type="checkbox" checked={fields.helpOptions.includes(option.value)} onChange={() => toggleHelp(option.value)} /><span>{option.label}</span></label>)}
        </fieldset>

        <fieldset>
          <legend>Parent or guardian contact</legend>
          <div className={styles.grid}>
            <label className={styles.field}>Parent/guardian name<input value={fields.guardianName} onChange={(event) => update("guardianName", event.target.value)} autoComplete="name" required /></label>
            <label className={styles.field}>Parent/guardian email<input type="email" value={fields.guardianEmail} onChange={(event) => update("guardianEmail", event.target.value)} autoComplete="email" required /></label>
          </div>
          <label className={styles.field}>Best phone number <small>Optional</small><input type="tel" value={fields.guardianPhone} onChange={(event) => update("guardianPhone", event.target.value)} autoComplete="tel" /></label>
        </fieldset>

        <fieldset className={styles.agreement}>
          <legend>Acknowledgement and signatures</legend>
          <ul>
            <li>This is an initial family intent response, not the final trip contract.</li>
            <li>A “yes” includes a $50 conditional deposit credited toward the student&apos;s trip account.</li>
            <li>A “yes” means the family seriously intends to participate if its total responsibility is no more than $2,000.</li>
            <li>If the eventual family responsibility would exceed $2,000, Ashley must return to families for a new decision; this acknowledgement does not authorize a higher family obligation.</li>
            <li>The deposit is refundable until the participation threshold is confirmed and Ashley Bands pays the WorldStrides group deposit; after that it becomes nonrefundable.</li>
            <li>Concert Band participation remains subject to approval. An unapproved Concert Band student&apos;s $50 will be refunded.</li>
            <li>The current trip price is a planning estimate, not a final price.</li>
          </ul>
          <div className={styles.grid}>
            <label className={styles.field}>Parent/guardian signature <small>Type full name</small><input value={fields.guardianSignature} onChange={(event) => update("guardianSignature", event.target.value)} required /></label>
            <label className={styles.field}>Student signature <small>Type full name</small><input value={fields.studentSignature} onChange={(event) => update("studentSignature", event.target.value)} required /></label>
          </div>
          <label className={styles.check}><input type="checkbox" checked={fields.termsAccepted} onChange={(event) => update("termsAccepted", event.target.checked)} required /><span>I have reviewed the acknowledgement above and certify that these typed names are our signatures.</span></label>
        </fieldset>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button className={styles.submit} type="submit" disabled={busy || (portalMode && !studentId)}>{busy ? "Saving…" : fields.response === "serious_yes" ? "Save commitment and continue to $50 payment" : "Save family response"}</button>
        <p className={styles.fallback}>Cannot use this form tonight? Tell a staff member. Staff can record the verbal commitment, mark login help for follow-up, and the $50 remains clearly labeled unpaid until payment is actually received.</p>
      </form>
    </main>
  );
}
