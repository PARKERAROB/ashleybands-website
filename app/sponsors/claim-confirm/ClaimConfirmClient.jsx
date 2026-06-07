"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

// Scanner-safe confirm page for the day-6 reclaim nudge. The email link lands here (a bare
// GET that changes nothing); the actual mark-contacted / release only happens when the
// person clicks the button, which POSTs to /api/sponsors/claim-action.
export default function ClaimConfirmClient() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const action = (params.get("a") || "").toLowerCase();
  const invalid = params.get("status") === "invalid" || !token || !["went", "pool"].includes(action);

  const [state, setState] = useState("idle"); // idle | working | done | error
  const [result, setResult] = useState(null);

  async function confirm() {
    setState("working");
    try {
      const res = await fetch("/api/sponsors/claim-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setState("error");
        setResult(json);
        return;
      }
      setState("done");
      setResult(json);
    } catch {
      setState("error");
    }
  }

  const wrap = {
    maxWidth: 460,
    margin: "0 auto",
    padding: "48px 18px",
    textAlign: "center",
    color: "#20160f"
  };
  const btn = {
    background: action === "pool" ? "#f0f0f0" : "#7b1829",
    color: action === "pool" ? "#555" : "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 22px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer"
  };

  if (invalid) {
    return (
      <main style={wrap}>
        <h1>Link expired</h1>
        <p>This confirmation link is no longer valid. Open your sponsorship dashboard in the Family Portal instead.</p>
        <p><a href="/portal/sponsorship" style={{ color: "#7b1829" }}>Open my dashboard</a></p>
      </main>
    );
  }

  if (state === "done") {
    return (
      <main style={wrap}>
        <h1>{result?.action === "went" ? "Got it — it stays yours" : "Released to the pool"}</h1>
        <p>
          {result?.action === "went"
            ? "Thanks for following up. This business is still on your list."
            : "No problem. This business is back in the pool for another family."}
        </p>
        <p><a href="/portal/sponsorship" style={{ color: "#7b1829" }}>Open my dashboard</a></p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main style={wrap}>
        <h1>That didn&apos;t work</h1>
        <p>{result?.reason === "not_yours" ? "This lead isn't currently assigned to you." : "Please try again from your dashboard."}</p>
        <p><a href="/portal/sponsorship" style={{ color: "#7b1829" }}>Open my dashboard</a></p>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <h1>{action === "went" ? "Mark this business contacted?" : "Send this business back to the pool?"}</h1>
      <p>
        {action === "went"
          ? "We'll keep it assigned to you and stop the countdown."
          : "It will become available for another family to claim."}
      </p>
      <button type="button" style={btn} disabled={state === "working"} onClick={confirm}>
        {state === "working" ? "Saving…" : action === "went" ? "Yes, I went to see them" : "Yes, send it to the pool"}
      </button>
    </main>
  );
}
