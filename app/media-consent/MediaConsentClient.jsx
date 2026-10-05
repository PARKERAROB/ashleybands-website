"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Notice from "@/components/ui/Notice";
import Button from "@/components/ui/Button";

const CONTACT = "robert.parker@nhcs.net";

function Panel({ title, children }) {
  return (
    <main className="narrow-page confirm-page">
      <PageHeader title={title} />
      <div className="copy-block">{children}</div>
    </main>
  );
}

function ErrorPanel({ message }) {
  return (
    <Panel title="That did not go through">
      <p>{message || "We couldn't record your answer from this link."}</p>
      <p>
        You can email Mr. Parker at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </Panel>
  );
}

async function call(url, init) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  return response.ok ? data : { error: data.error || "" };
}

// Opening the link only looks up the student's name (a read-only GET). The answer is
// recorded only when a person presses a button. Mail scanners open links in real
// browsers, so nothing may record on page load (#177, was #162).
export default function MediaConsentClient() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const emailed = params.get("a") || "";
  const valid = Boolean(token) && (emailed === "yes" || emailed === "no");
  const [student, setStudent] = useState(null); // { firstName, preview } | { error }
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { answer, firstName, preview } | { error }

  useEffect(() => {
    if (!valid) return;
    let active = true;
    call(`/api/media-consent?t=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((data) => active && setStudent(data))
      .catch(() => active && setStudent({ error: "" }));
    return () => {
      active = false;
    };
  }, [token, valid]);

  async function record(answer) {
    setSaving(true);
    const data = await call("/api/media-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ t: token, a: answer }),
    }).catch(() => ({ error: "" }));
    setResult(data.error === undefined ? { ...data, answer } : data);
    setSaving(false);
  }

  if (!valid) return <ErrorPanel message="This link is missing information." />;
  if (student?.error !== undefined) return <ErrorPanel message={student.error} />;
  if (result?.error !== undefined) return <ErrorPanel message={result.error} />;
  if (!student) {
    return (
      <Panel title="Media permission">
        <p>One moment.</p>
      </Panel>
    );
  }

  const name = student.firstName;
  const previewNote = student.preview && (
    <Notice tone="info" title="This is a preview.">
      <p>Nothing is recorded. In the real email, this page saves the answer for each student.</p>
    </Notice>
  );

  if (!result) {
    const choices = [
      { answer: "yes", label: `Record Yes: ${name} may be interviewed` },
      { answer: "no", label: `Record No: no interviews for ${name}` },
    ];
    if (emailed === "no") choices.reverse();
    return (
      <Panel title="Media permission">
        {previewNote}
        <p>
          Please confirm your answer for <strong>{name}</strong>. Nothing is saved until you press a button.
        </p>
        <div className="consent-actions">
          {choices.map((choice) => (
            <Button
              key={choice.answer}
              variant={choice.answer === emailed ? "primary" : "secondary"}
              disabled={saving}
              onClick={() => record(choice.answer)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
        <p>Mr. Parker</p>
      </Panel>
    );
  }

  const other = result.answer === "yes" ? "no" : "yes";
  return (
    <Panel title="Thank you">
      {previewNote}
      {result.answer === "yes" ? (
        <p>
          We recorded <strong>Yes</strong> for {name}. {name} may talk with reporters if they want to.
        </p>
      ) : (
        <p>
          We recorded <strong>No</strong> for {name}. {name} will not be interviewed.
        </p>
      )}
      <p>
        Changed your mind?{" "}
        <a href={`/media-consent?t=${encodeURIComponent(token)}&a=${other}`}>
          {other === "yes" ? `Change to Yes for ${name}` : `Change to No for ${name}`}
        </a>
        . Your latest answer is the one we use.
      </p>
      <p>Mr. Parker</p>
    </Panel>
  );
}
