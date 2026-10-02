"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Notice from "@/components/ui/Notice";

const CONTACT = "robert.parker@nhcs.net";

function Panel({ title, children }) {
  return (
    <main className="narrow-page confirm-page">
      <PageHeader title={title} />
      <div className="copy-block">{children}</div>
    </main>
  );
}

// Records on page load from a client request, not on the GET itself, so a
// server-side link fetch never records an answer (#162).
export default function MediaConsentClient() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const answer = params.get("a") || "";
  const valid = Boolean(token) && (answer === "yes" || answer === "no");
  const [result, setResult] = useState(null); // { ok, firstName, preview } | { error }

  useEffect(() => {
    if (!valid || (navigator.webdriver && token !== "preview")) return;
    let active = true;
    fetch("/api/media-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, a: answer }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (active) setResult(response.ok ? data : { error: data.error || "" });
      })
      .catch(() => active && setResult({ error: "" }));
    return () => {
      active = false;
    };
  }, [token, answer, valid]);

  if (!valid || result?.error !== undefined) {
    return (
      <Panel title="That did not go through">
        <p>{!valid ? "This link is missing information." : result.error || "We couldn't record your answer from this link."}</p>
        <p>
          You can email Mr. Parker at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Panel>
    );
  }

  if (!result) {
    return (
      <Panel title="Saving your answer">
        <p>One moment.</p>
      </Panel>
    );
  }

  const name = result.firstName;
  const other = answer === "yes" ? "no" : "yes";
  const otherHref = `/media-consent?t=${encodeURIComponent(token)}&a=${other}`;

  return (
    <Panel title="Thank you">
      {result.preview && (
        <Notice tone="info" title="This is a preview.">
          <p>Nothing was recorded. In the real email, this page saves the answer for each student.</p>
        </Notice>
      )}
      {answer === "yes" ? (
        <p>
          We recorded <strong>Yes</strong> for {name}. {name} may talk with reporters if they want to.
        </p>
      ) : (
        <p>
          We recorded <strong>No</strong> for {name}. {name} will not be interviewed.
        </p>
      )}
      <p>
        Changed your mind? <a href={otherHref}>{other === "yes" ? `Change to Yes for ${name}` : `Change to No for ${name}`}</a>.
        Your latest answer is the one we use.
      </p>
      <p>Mr. Parker</p>
    </Panel>
  );
}
