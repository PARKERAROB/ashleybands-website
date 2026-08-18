"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function requestedDestination() {
  if (typeof window === "undefined") return "/portal/review";
  const requested = new URLSearchParams(window.location.search).get("next") || "";
  return requested.startsWith("/portal/") && !requested.startsWith("//") ? requested : "/portal/review";
}

export default function PortalClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email"); // "email" | "code"
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/portal/review");

  // Already signed in? Skip the login screen and go to the profile.
  useEffect(() => {
    let cancelled = false;
    const destination = requestedDestination();
    // Keep the post-sign-in target stable without making server rendering read the browser URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNextPath(destination);
    fetch("/api/portal/session")
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((data) => {
        if (!cancelled && data?.signedIn) router.replace(destination);
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
    try {
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
    } catch {
      setStatus("error");
      setMessage("We could not reach the portal. Check your connection and try again.");
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setStatus("verifying");
    setMessage("");
    try {
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
      router.replace(requestedDestination());
    } catch {
      setStatus("error");
      setMessage("We could not reach the portal. Check your connection and try again.");
    }
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Family Portal</h1>

        {step === "email" ? (
          <>
            <p className="portal-copy">
              Review family contacts, student information, marching band funding, payments, and uniform measurements. Enter an email already connected to your family and we&apos;ll send a 6-digit code.
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

        {message ? <p className={`portal-message ${status === "error" ? "error" : ""}`} aria-live="polite">{message}</p> : null}
        <p className="portal-footnote">
          New email or another student to connect? <Link href={`/portal/request?next=${encodeURIComponent(nextPath)}`}>Request profile access</Link>. A verified email with a roster match connects immediately. If no roster match is found, Mr. Parker will follow up.
        </p>
      </section>
    </main>
  );
}
