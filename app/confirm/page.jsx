"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function StatusPanel({ title, children }) {
  return (
    <main className="narrow-page">
      <h1>{title}</h1>
      <div className="copy-block">
        {children}
      </div>
    </main>
  );
}

const VALID_ACTIONS = new Set(["out", "talk", "band_only", "mb_info"]);

function ForwardedEmailFallback({ studentId, action, studentName, parentName }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [message, setMessage] = useState("");

  function submitContact(event) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("saving");
    setMessage("");
    fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        s: studentId,
        a: action,
        n: studentName,
        p: parentName,
        e: trimmedEmail,
        note: note.trim() || "Forwarded email contact update"
      })
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `error ${r.status}`);
        }
        setStatus("saved");
        setMessage("Thanks. That contact email was added to the response.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("That did not save. You can still email Mr. Parker directly.");
      });
  }

  return (
    <form className="fallback-form" onSubmit={submitContact}>
      <h2>Was this email forwarded to you?</h2>
      <p>If Mr. Parker may not have your current email address, add it here so he knows who responded.</p>
      <label>
        Email address
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          disabled={status === "saving" || status === "saved"}
        />
      </label>
      <label>
        Optional note
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything Mr. Parker should know"
          disabled={status === "saving" || status === "saved"}
        />
      </label>
      <button type="submit" disabled={status === "saving" || status === "saved"}>
        {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Add email"}
      </button>
      {message && <p className={`fallback-message ${status === "error" ? "error" : ""}`}>{message}</p>}
    </form>
  );
}

function ConfirmInner() {
  const params = useSearchParams();
  const studentId = params.get("s") || "";
  const action = params.get("a") || "";
  const studentName = params.get("n") || "";
  const parentName = params.get("p") || "";
  const invalidLink = !studentId || !VALID_ACTIONS.has(action);

  const [state, setState] = useState("loading"); // loading | success | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (invalidLink) {
      return;
    }
    fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s: studentId, a: action, n: studentName, p: parentName })
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || `error ${r.status}`);
        }
        setState("success");
      })
      .catch((err) => {
        setState("error");
        setError(err.message || "Something went wrong.");
      });
  }, [studentId, action, studentName, parentName, invalidLink]);

  const friendlyName = studentName || "your student";

  if (invalidLink) {
    return (
      <StatusPanel title="Hmm, something went wrong">
        <p>This confirmation link is missing information. If you got this email and want to respond, just reply directly and Mr. Parker will sort it out.</p>
        <p>You can also just reply to Mr. Parker&rsquo;s email directly and he&rsquo;ll take care of it.</p>
        <p><a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a></p>
      </StatusPanel>
    );
  }

  if (state === "loading") {
    return (
      <StatusPanel title="Recording your response…">
        <p>One moment.</p>
      </StatusPanel>
    );
  }

  if (state === "error") {
    return (
      <StatusPanel title="Hmm, something went wrong">
        <p>{error}</p>
        <p>You can also just reply to Mr. Parker&rsquo;s email directly and he&rsquo;ll take care of it.</p>
        <p><a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a></p>
      </StatusPanel>
    );
  }

  // success
  if (action === "out") {
    return (
      <StatusPanel title="Got it — thanks!">
        <p>Recorded that {friendlyName} won&rsquo;t be in band at Ashley next year. No further follow-up needed.</p>
        <p>The door stays open. If anything changes mid-summer, just send Mr. Parker a note.</p>
        <ForwardedEmailFallback studentId={studentId} action={action} studentName={studentName} parentName={parentName} />
        <p style={{ marginTop: "1.5rem" }}>
          <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>
        </p>
      </StatusPanel>
    );
  }

  if (action === "band_only") {
    return (
      <StatusPanel title="Got it — thanks!">
        <p>Recorded that {friendlyName} is planning to take band class, but not marching band.</p>
        <p>Mr. Parker is looking forward to having {friendlyName} in band class next semester.</p>
        <ForwardedEmailFallback studentId={studentId} action={action} studentName={studentName} parentName={parentName} />
        <p style={{ marginTop: "1.5rem" }}>
          <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>
        </p>
      </StatusPanel>
    );
  }

  if (action === "mb_info") {
    return (
      <StatusPanel title="Thanks — Mr. Parker will send more information">
        <p>Recorded that you would like more specific marching band information for {friendlyName} before deciding.</p>
        <p>Mr. Parker will send the sign-up information and next steps.</p>
        <ForwardedEmailFallback studentId={studentId} action={action} studentName={studentName} parentName={parentName} />
        <p>If you want to reach him directly, you can email:</p>
        <p>
          <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>
        </p>
      </StatusPanel>
    );
  }

  return (
    <StatusPanel title="Thanks — Mr. Parker will reach out">
      <p>Recorded that you&rsquo;d like to talk before deciding on band for {friendlyName}.</p>
      <p>Mr. Parker will be in touch within a few days to find a time that works.</p>
      <ForwardedEmailFallback studentId={studentId} action={action} studentName={studentName} parentName={parentName} />
      <p>If you want to speed things up, you can email him directly:</p>
      <p>
        <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>
      </p>
    </StatusPanel>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<StatusPanel title="Loading…"><p>One moment.</p></StatusPanel>}>
      <ConfirmInner />
    </Suspense>
  );
}
