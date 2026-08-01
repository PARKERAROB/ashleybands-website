"use client";

import Link from "next/link";
import { useState } from "react";

export default function PortalRequestClient() {
  const [form, setForm] = useState({
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    studentFirst: "",
    studentLast: "",
    studentGrade: "",
    instrumentOrNote: ""
  });
  const [step, setStep] = useState("form"); // "form" | "code" | "done"
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const guardianEmail = form.guardianEmail.trim().toLowerCase();

  async function submit(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/portal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Could not submit the request.");
        return;
      }
      setStep("code");
      setStatus("idle");
      setMessage("We emailed a 6-digit code to verify your email. Enter it below - it expires in 30 minutes.");
    } catch {
      setStatus("error");
      setMessage("We could not reach the portal. Check your connection and try again.");
    }
  }

  async function verify(event) {
    event.preventDefault();
    setStatus("verifying");
    setMessage("");
    try {
      const res = await fetch("/api/portal/request/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guardianEmail, code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "That code did not work. Try again.");
        return;
      }
      setStep("done");
      setStatus("idle");
      setMessage(
        data.granted
          ? "You're all set - your account is connected. Sign in from the portal page with this email any time."
          : "Your email is verified, but we couldn't automatically match that student on the roster. Mr. Parker will follow up with you."
      );
    } catch {
      setStatus("error");
      setMessage("We could not reach the portal. Check your connection and try again.");
    }
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel portal-panel-wide">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Request Profile Access</h1>

        {step === "form" ? (
          <>
            <p className="portal-copy">
              Use this when your email is new or not connected to the right student yet. If the student matches the roster, you&apos;ll be connected as soon as your email is verified. If not, Mr. Parker will follow up.
            </p>
            <form className="portal-request-form" onSubmit={submit}>
              <label>
                <span>Guardian name</span>
                <input value={form.guardianName} onChange={(event) => update("guardianName", event.target.value)} required />
              </label>
              <label>
                <span>Guardian email</span>
                <input type="email" value={form.guardianEmail} onChange={(event) => update("guardianEmail", event.target.value)} required />
              </label>
              <label>
                <span>Guardian phone</span>
                <input value={form.guardianPhone} onChange={(event) => update("guardianPhone", event.target.value)} />
              </label>
              <label>
                <span>Student first name</span>
                <input value={form.studentFirst} onChange={(event) => update("studentFirst", event.target.value)} required />
              </label>
              <label>
                <span>Student last name</span>
                <input value={form.studentLast} onChange={(event) => update("studentLast", event.target.value)} required />
              </label>
              <label>
                <span>Student grade</span>
                <input value={form.studentGrade} onChange={(event) => update("studentGrade", event.target.value)} placeholder="Rising 9th" />
              </label>
              <label className="portal-request-wide">
                <span>Instrument or note</span>
                <textarea value={form.instrumentOrNote} onChange={(event) => update("instrumentOrNote", event.target.value)} rows={4} />
              </label>
              <button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending..." : "Send code"}
              </button>
              <p className="portal-consent-note">
                By submitting, you confirm this information is yours to share. See our{" "}
                <a href="/privacy">Privacy Notice</a>.
              </p>
            </form>
          </>
        ) : null}

        {step === "code" ? (
          <>
            <p className="portal-copy">
              Enter the 6-digit code we emailed to <strong>{guardianEmail}</strong>.
            </p>
            <form className="portal-form" onSubmit={verify}>
              <label htmlFor="request-code">6-digit code</label>
              <div className="portal-row">
                <input
                  id="request-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
                <button type="submit" disabled={status === "verifying" || code.length < 6}>
                  {status === "verifying" ? "Checking..." : "Verify email"}
                </button>
              </div>
            </form>
            <p className="portal-footnote">
              Didn&apos;t get it?{" "}
              <button
                type="button"
                className="portal-link-btn"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setMessage("");
                  setStatus("idle");
                }}
              >
                Check your details and send again
              </button>
            </p>
          </>
        ) : null}

        {step === "done" ? (
          <p className="portal-footnote">
            <Link href="/portal">Return to the family profile page</Link>
          </p>
        ) : null}

        {message ? <p className={`portal-message ${status === "error" ? "error" : ""}`} aria-live="polite">{message}</p> : null}
      </section>
    </main>
  );
}
