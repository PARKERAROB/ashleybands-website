"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./staff-sprint.css";

export default function StaffSprintLanding() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function join(event) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a session code.");
      return;
    }
    router.push(`/staff-sprint/play/${trimmed}`);
  }

  return (
    <main className="staff-sprint-page">
      <p className="eyebrow">Ashley Bands</p>
      <h1>Staff Sprint</h1>
      <p className="ss-muted">Race your section. First to identify enough notes wins.</p>

      <section className="ss-card">
        <h2 style={{ marginTop: 0 }}>Join a race</h2>
        <form onSubmit={join}>
          <label className="ss-field">
            <span>Session code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC12"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontSize: "1.5rem", letterSpacing: "0.15em", textAlign: "center" }}
            />
          </label>
          {error && <div className="ss-error">{error}</div>}
          <button type="submit" className="ss-btn ss-btn--primary">Join</button>
        </form>
      </section>

      <section className="ss-card">
        <h2 style={{ marginTop: 0 }}>Teacher</h2>
        <p className="ss-muted" style={{ marginTop: 0 }}>Start a classroom session.</p>
        <Link href="/staff-sprint/teacher" className="ss-btn ss-btn--primary" style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
          Create session
        </Link>
      </section>
    </main>
  );
}
