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

function ConfirmInner() {
  const params = useSearchParams();
  const studentId = params.get("s") || "";
  const action = params.get("a") || "";
  const studentName = params.get("n") || "";
  const parentName = params.get("p") || "";

  const [state, setState] = useState("loading"); // loading | success | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId || (action !== "out" && action !== "talk")) {
      setState("error");
      setError("This confirmation link is missing information. If you got this email and want to respond, just reply directly and Mr. Parker will sort it out.");
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
  }, [studentId, action, studentName, parentName]);

  const friendlyName = studentName || "your student";

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
        <p style={{ marginTop: "1.5rem" }}>
          <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>
        </p>
      </StatusPanel>
    );
  }

  return (
    <StatusPanel title="Thanks — Mr. Parker will reach out">
      <p>Recorded that you&rsquo;d like to talk before deciding on band for {friendlyName}.</p>
      <p>Mr. Parker will be in touch within a few days to find a time that works.</p>
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
