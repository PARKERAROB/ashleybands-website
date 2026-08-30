"use client";

import { useState } from "react";

export default function NewsletterSignup({ compact = false }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website })
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || "We could not start the subscription.");
        return;
      }
      setEmail("");
      setStatus(data.message || "Check your email to confirm your subscription.");
    } catch {
      setStatus("We could not start the subscription. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={compact ? "newsletter-signup newsletter-signup-compact" : "newsletter-signup"} onSubmit={submit}>
      <div className="newsletter-signup-fields">
        <label htmlFor={compact ? "newsletter-email-compact" : "newsletter-email"}>
          Email address
        </label>
        <div className="newsletter-signup-row">
          <input
            id={compact ? "newsletter-email-compact" : "newsletter-email"}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Subscribe"}
          </button>
        </div>
      </div>
      <div className="newsletter-honeypot" aria-hidden="true" hidden>
        <label htmlFor={compact ? "newsletter-website-compact" : "newsletter-website"}>Website</label>
        <input
          id={compact ? "newsletter-website-compact" : "newsletter-website"}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>
      <p className="newsletter-signup-note">
        Community subscription only. Current Ashley Bands students and families receive the member edition separately.
        Confirm by email before the subscription becomes active. Unsubscribe any time.
      </p>
      {status && <p className="newsletter-signup-status" role="status">{status}</p>}
    </form>
  );
}
