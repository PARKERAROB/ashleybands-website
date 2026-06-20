"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email"); // "email" | "code"
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  // Already signed in? Skip the login screen and go to the profile.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/session")
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data) => {
        if (!cancelled && data?.signedIn) router.replace("/portal/review");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function sendCode(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/portal/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "Something went wrong. Try again.");
      return;
    }
    setStep("code");
    setStatus("idle");
    setMessage("If that email is in the Ashley Bands profile system, a 6-digit code is on the way. Enter it below.");
  }

  async function verifyCode(event) {
    event.preventDefault();
    setStatus("verifying");
    setMessage("");
    const res = await fetch("/api/portal/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "That code did not work. Try again or request a new one.");
      return;
    }
    router.replace("/portal/review");
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Family Profile</h1>

        {step === "email" ? (
          <>
            <p className="portal-copy">
              Enter the email address where you receive Ashley Bands messages. We&apos;ll email a 6-digit code if it matches a current profile record.
            </p>
            <form className="portal-form" onSubmit={sendCode}>
              <label htmlFor="portal-email">Email address</label>
              <div className="portal-row">
                <input
                  id="portal-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <button type="submit" disabled={status === "sending"}>
                  {status === "sending" ? "Sending..." : "Send code"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="portal-copy">
              Enter the 6-digit code we emailed to <strong>{email}</strong>. It expires in 15 minutes.
            </p>
            <form className="portal-form" onSubmit={verifyCode}>
              <label htmlFor="portal-code">6-digit code</label>
              <div className="portal-row">
                <input
                  id="portal-code"
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
                  {status === "verifying" ? "Checking..." : "Sign in"}
                </button>
              </div>
            </form>
            <p className="portal-footnote">
              Didn&apos;t get it?{" "}
              <button
                type="button"
                className="portal-link-btn"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setMessage("");
                  setStatus("idle");
                }}
              >
                Use a different email or send again
              </button>
            </p>
          </>
        )}

        {message ? <p className={`portal-message ${status === "error" ? "error" : ""}`}>{message}</p> : null}
        <p className="portal-footnote">
          New email or family change? <Link href="/portal/request">Request profile access</Link>. Unknown access requests go through Mr. Parker&apos;s review before any private record is shown.
        </p>
      </section>
    </main>
  );
}
