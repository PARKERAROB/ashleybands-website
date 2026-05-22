"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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

  async function submit(event) {
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
    setStatus("sent");
    setMessage("If that email is in the Ashley Bands profile system, a secure link is on the way.");
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Family Profile</h1>
        <p className="portal-copy">
          Enter the email address where you receive Ashley Bands messages. We&apos;ll send a secure link if it matches a current profile record.
        </p>
        <form className="portal-form" onSubmit={submit}>
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
              {status === "sending" ? "Sending..." : "Send link"}
            </button>
          </div>
        </form>
        {message ? <p className={`portal-message ${status === "error" ? "error" : ""}`}>{message}</p> : null}
        <p className="portal-footnote">
          New email or family change? <Link href="/portal/request">Request profile access</Link>. Unknown access requests go through Mr. Parker&apos;s review before any private record is shown.
        </p>
      </section>
    </main>
  );
}
