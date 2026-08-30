"use client";

import { useState } from "react";

export default function NewsletterPreferenceAction({ mode, token }) {
  const [state, setState] = useState("ready");
  const [message, setMessage] = useState("");
  const confirming = mode === "confirm";

  async function act() {
    setState("working");
    setMessage("");
    try {
      const response = await fetch(`/api/newsletter/${confirming ? "confirm" : "unsubscribe"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await response.json();
      if (!response.ok) {
        setState("error");
        setMessage(data.error || "This preference link could not be used.");
        return;
      }
      setState("done");
      setMessage(
        confirming
          ? "You are subscribed to the public edition of AshleyBands Weekly."
          : "You are unsubscribed from AshleyBands Weekly. Urgent program messages are managed separately."
      );
    } catch {
      setState("error");
      setMessage("This preference could not be updated. Please try again.");
    }
  }

  if (!token) {
    return <p className="newsletter-action-message is-error">This preference link is incomplete.</p>;
  }

  return (
    <div className="newsletter-action-card">
      <p>
        {confirming
          ? "Confirm that you want the public AshleyBands Weekly newsletter sent to this email address."
          : "Stop AshleyBands Weekly at this email address. This will not stop urgent or transactional program messages."}
      </p>
      {state !== "done" && (
        <button type="button" className="newsletter-primary-button" onClick={act} disabled={state === "working"}>
          {state === "working" ? "Working…" : confirming ? "Confirm subscription" : "Unsubscribe"}
        </button>
      )}
      {message && (
        <p className={`newsletter-action-message${state === "error" ? " is-error" : ""}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
