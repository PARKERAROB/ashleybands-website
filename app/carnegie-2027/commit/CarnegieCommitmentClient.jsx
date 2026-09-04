"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CARNEGIE_AGREEMENT_VERSION,
  CARNEGIE_AMOUNT_BANDS,
  CARNEGIE_DEPOSIT_CHOICES,
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
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else {
        paypalSdkPromise = null;
        reject(new Error("PayPal loaded without payment options."));
      }
    };
    script.onerror = () => {
      paypalSdkPromise = null;
      script.remove();
      reject(new Error("Could not load PayPal."));
    };
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
  response: "",
  maximumFamilyAmountBand: "",
  depositChoice: "",
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
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [paymentAttempt, setPaymentAttempt] = useState(0);
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

  useEffect(() => {
    if (!result?.depositRequested || result?.paid || !result?.checkoutToken || !paypalRef.current) return;
    let cancelled = false;
    const paypalContainer = paypalRef.current;
    const checkoutToken = result.checkoutToken;
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

    async function renderPaymentButtons() {
      if (!clientId) {
        setPaymentStatus("error");
        setPaymentMessage("Online payment is not available right now. Your commitment and $50 ledger charge are saved; staff can help you finish payment.");
        return;
      }
      setPaymentStatus("loading");
      setPaymentMessage("Loading secure PayPal and card options…");
      try {
        const paypal = await loadPaypalSdk(clientId);
        if (cancelled) return;
        paypalContainer.innerHTML = "";
        await paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => {
            const response = await fetch("/api/carnegie-2027/payment/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ checkoutToken }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || "Could not start payment.");
            return body.orderId;
          },
          onApprove: async (data) => {
            setPaymentStatus("loading");
            setPaymentMessage("Confirming the payment in the AshleyBands ledger…");
            const response = await fetch("/api/carnegie-2027/payment/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID, checkoutToken }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || "Payment could not be confirmed.");
            setResult((current) => ({ ...current, paid: true, checkoutToken: "", invoiceId: body.invoiceId }));
            setPaymentStatus("complete");
            setPaymentMessage("Payment received. The $50 deposit is now visible in the family and staff financial records.");
          },
          onCancel: () => {
            setPaymentStatus("ready");
            setPaymentMessage("Payment was cancelled. Your commitment is saved and the $50 balance remains available below.");
          },
          onError: (caught) => {
            setPaymentStatus("error");
            setPaymentMessage(caught?.message || "PayPal could not complete the payment. Your commitment is still saved.");
          },
        }).render(paypalContainer);
        if (!cancelled) {
          setPaymentStatus("ready");
          setPaymentMessage("Choose a secure PayPal or card option below to finish the $50 deposit.");
        }
      } catch (caught) {
        if (!cancelled) {
          setPaymentStatus("error");
          setPaymentMessage(caught.message || "Could not open PayPal. Your commitment is still saved.");
        }
      }
    }

    renderPaymentButtons();
    return () => {
      cancelled = true;
      paypalContainer.innerHTML = "";
    };
  }, [paymentAttempt, result?.checkoutToken, result?.depositRequested, result?.paid]);

  function update(field, value) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function chooseResponse(response) {
    setFields((current) => ({
      ...current,
      response,
      maximumFamilyAmountBand: response === "interested_limited" ? current.maximumFamilyAmountBand : "",
      depositChoice: response === "no" ? "" : current.depositChoice,
    }));
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

  const selectedStudent = portalData?.students?.find((student) => student.id === studentId);
  const responseLabel = result ? carnegieResponseLabel(result.response, result.agreementVersion) : "";

  if (loading) return <main className={styles.page}><section className={styles.card}><p>Opening the Carnegie commitment…</p></section></main>;

  if (portalMode && error && !portalData) return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>Ashley Bands Family Portal</p><h1>Sign in to continue.</h1><p>{error} You can sign in and return here, or use the public commitment form without signing in.</p><div className={styles.actions}><Link href="/portal?next=%2Fportal%2Fcarnegie-2027">Sign in to Family Portal</Link><Link href="/carnegie-2027/commit">Use the public form</Link></div></section></main>;

  if (portalMode && result?.source === "staff_verbal") return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>Carnegie Hall 2027</p><h1>A verbal response is on file.</h1><p>Staff recorded this as an unsigned fallback for {selectedStudent?.displayName || "this student"}. Review the current choices and complete the acknowledgement and typed signatures now. Every yes response includes a separate choice to pay the $50 conditional deposit now or mark that it cannot be paid at this time.</p><div className={styles.actions}><button className={styles.primaryButton} type="button" onClick={() => { const currentVersion = result.agreementVersion === CARNEGIE_AGREEMENT_VERSION; setFields((current) => ({ ...current, response: currentVersion ? result.response : "", maximumFamilyAmountBand: currentVersion ? result.maximumFamilyAmountBand || "" : "", depositChoice: currentVersion ? result.depositChoice || "" : "" })); setResult(null); }}>Complete and sign this response</button><Link href="/portal/review">Return to Family Portal</Link></div></section></main>;

  if (result) {
    return (
      <main className={styles.page}>
        <section className={`${styles.card} ${styles.confirmation}`}>
          <p className={styles.eyebrow}>Carnegie Hall 2027</p>
          <h1>Your response is saved.</h1>
          <p><strong>{responseLabel}</strong>{result.studentName ? ` for ${result.studentName}` : selectedStudent ? ` for ${selectedStudent.displayName}` : ""}.</p>
          {result.depositRequested ? (
            result.paid ? (
              <div className={styles.success}><strong>$50 received</strong><span>The payment is connected to the AshleyBands family financial ledger.</span></div>
            ) : (
              <div className={styles.paymentPanel}>
                <span>Conditional deposit</span><strong>$50</strong>
                <p>Refundable until the participation threshold is confirmed and the Ashley High School Band Boosters pay the WorldStrides group deposit. If an unapproved Concert Band student pays, the $50 will be refunded.</p>
                {paymentMessage ? <p className={paymentStatus === "error" ? styles.paymentError : styles.message} role={paymentStatus === "error" ? "alert" : "status"}>{paymentMessage}</p> : null}
                <div className={styles.paypal} ref={paypalRef} aria-label="Secure PayPal and card payment options" />
                {paymentStatus === "error" ? <button className={styles.primaryButton} type="button" onClick={() => setPaymentAttempt((current) => current + 1)}>Try loading payment options again</button> : null}
                <p className={styles.resume}>Need to finish later? Return through the <Link href="/portal/carnegie-2027">Family Portal Carnegie page</Link>. If you do not use the portal, reopen this public form with the same exact student details and submit the response again to restore the payment step.</p>
              </div>
            )
          ) : result.paid ? (
            <p className={styles.notice}>Your earlier $50 payment remains recorded. Updating the family response does not automatically issue a refund. Staff will review the payment under the current conditional-deposit terms.</p>
          ) : result.depositChoice === "cannot_pay_now" ? (
            <p className={styles.notice}>Your yes response is saved. You marked that the $50 conditional deposit cannot be paid at this time. No charge was created, and this does not remove the student from trip planning.</p>
          ) : (
            <p className={styles.notice}>No deposit was requested for this response. Thank you for giving the band program clear planning information.</p>
          )}
          <div className={styles.actions}>
            {portalMode ? <Link href="/portal/review">Return to Family Portal</Link> : <Link href="/portal">Open Family Portal</Link>}
            <button type="button" className={styles.textButton} onClick={() => { setResult(null); setPaymentMessage(""); setPaymentStatus("idle"); }}>Update this response</button>
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
        <p>Submit one response per student by Friday, September 4. Tell us whether the student would participate, what total family responsibility would be realistic, and whether the $50 conditional deposit can be paid now. Every yes response includes the same deposit choice.</p>
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
          <p>The trip is currently planning around $2,500 per traveler. Ashley Bands is working to lower the cost for every student, but no amount of outside funding and no lower family total is guaranteed yet.</p>
          <p>Cost should not turn a “yes, if funded” into a no. Choose no only if the student cannot participate regardless of financial assistance.</p>
          {CARNEGIE_RESPONSE_OPTIONS.map((option) => (
            <label className={`${styles.choice} ${fields.response === option.value ? styles.selected : ""}`} key={option.value}>
              <input type="radio" name="response" value={option.value} checked={fields.response === option.value} onChange={() => chooseResponse(option.value)} required />
              <span>{option.label}</span>
            </label>
          ))}
          {fields.response === "interested_limited" ? (
            <label className={styles.field}>Highest total family responsibility that would make participation realistic<select value={fields.maximumFamilyAmountBand} onChange={(event) => update("maximumFamilyAmountBand", event.target.value)} required><option value="">Choose a range</option>{CARNEGIE_AMOUNT_BANDS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
          ) : null}
        </fieldset>

        {fields.response && fields.response !== "no" ? (
          <fieldset>
            <legend>$50 conditional deposit</legend>
            <p>The deposit is separate from the total amount your family may be able to pay. Needing financial assistance does not remove the option to pay the deposit, and being unable to pay it now does not change your yes response.</p>
            {CARNEGIE_DEPOSIT_CHOICES.map((option) => (
              <label className={`${styles.choice} ${fields.depositChoice === option.value ? styles.selected : ""}`} key={option.value}>
                <input type="radio" name="depositChoice" value={option.value} checked={fields.depositChoice === option.value} onChange={() => update("depositChoice", option.value)} required />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <fieldset>
          <legend>Ways your family may be able to help</legend>
          <p>Optional. Check everything that applies. These choices do not affect the student&apos;s eligibility or promise financial assistance. Capital sponsorships, grants, major gifts, and shared campaigns lower the trip cost for all participating students rather than creating a private credit for one student.</p>
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
            <li>This response records whether the student is available and intends to participate separately from the family&apos;s financial capacity.</li>
            <li>Every yes response includes a separate $50 conditional-deposit choice, regardless of the family&apos;s maximum total responsibility.</li>
            <li>Choosing to pay now creates a $50 charge credited toward the student&apos;s trip account and continues to secure payment options after this response is saved.</li>
            <li>Choosing “cannot pay at this time” creates no new charge, does not change the yes response, and tells Ashley Bands that follow-up may be needed.</li>
            <li>An assistance-needed response does not guarantee financial assistance or a fully funded trip. It tells Ashley Bands what would need to be true financially for the student to participate.</li>
            <li>If outside support cannot bring the final family responsibility within the amount selected, the band program must return to the family for a new decision before final registration.</li>
            <li>A no response means the student cannot participate regardless of financial assistance.</li>
            <li>The deposit is refundable until the participation threshold is confirmed and the Ashley High School Band Boosters pay the WorldStrides group deposit; after that it becomes nonrefundable.</li>
            <li>The trip moves forward when the Boosters pay the group deposit, but the student is not individually confirmed until the WorldStrides portal registration and required paperwork are complete.</li>
            <li>Any later WorldStrides registration payment will be part of, not added to, the family&apos;s final approved responsibility. It will not begin until the final agreement and payment instructions are issued.</li>
            <li>Changing this response does not automatically refund a completed payment.</li>
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
        <button className={styles.submit} type="submit" disabled={busy || (portalMode && !studentId)}>{busy ? "Saving…" : fields.depositChoice === "pay_now" ? "Save yes response and continue to $50 payment" : fields.response && fields.response !== "no" ? "Save yes response" : "Save family response"}</button>
        <p className={styles.fallback}>Cannot use this form tonight? Tell a staff member. Staff can record the verbal response, including whether the $50 deposit can be paid now, and mark login help for follow-up. Payment is never marked received until it is actually completed.</p>
      </form>
    </main>
  );
}
