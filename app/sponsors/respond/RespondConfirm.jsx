"use client";

import { useState } from "react";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";

// Explicit-click confirmation. The page that renders this is read-only; the
// business's status only changes when a real person presses the button below,
// so automated mail scanners can't answer on their behalf.
export default function RespondConfirm({ token, action, businessName }) {
  const [state, setState] = useState("ready"); // ready | sending | yes | no | error

  async function submit() {
    setState("sending");
    try {
      const res = await fetch("/api/sponsors/business-respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action })
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      const data = await res.json();
      setState(data.status === "yes" ? "yes" : "no");
    } catch {
      setState("error");
    }
  }

  if (state === "yes") {
    return (
      <>
        <h1>Thank you.</h1>
        <p className="sponsors-lede">
          We've noted that {businessName} is open to hearing more. An Ashley band family will be
          in touch in the coming weeks with the details.
        </p>
        <p>
          If you'd like to reach out before then, the director is at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
        </p>
      </>
    );
  }

  if (state === "no") {
    return (
      <>
        <h1>Got it. No worries.</h1>
        <p className="sponsors-lede">
          We've removed {businessName} from our outreach list. Thanks for the moment of your time.
        </p>
        <p>
          If you change your mind down the road, the director is at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
        </p>
      </>
    );
  }

  if (state === "error") {
    return (
      <>
        <h1>Something went wrong.</h1>
        <p className="sponsors-lede">
          We couldn't record that just now. Please try the link again, or email the director at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
        </p>
      </>
    );
  }

  const isYes = action === "yes";
  return (
    <>
      <h1>{isYes ? "One quick confirmation" : "Confirm: remove from list"}</h1>
      <p className="sponsors-lede">
        {isYes ? (
          <>
            Press the button to let us know <strong>{businessName}</strong> is open to hearing
            from an Ashley band family about supporting the program.
          </>
        ) : (
          <>
            Press the button to remove <strong>{businessName}</strong> from our sponsorship
            outreach list. You won't hear from us again about this.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={state === "sending"}
        style={{
          display: "inline-block",
          background: isYes ? "#2f7a2f" : "#555",
          color: "#fff",
          padding: "12px 22px",
          borderRadius: 6,
          border: "none",
          fontWeight: 600,
          fontSize: 16,
          cursor: state === "sending" ? "default" : "pointer",
          opacity: state === "sending" ? 0.6 : 1
        }}
      >
        {state === "sending"
          ? "One moment..."
          : isYes
            ? "Yes, we're open to hearing more"
            : "Yes, remove us"}
      </button>
    </>
  );
}
