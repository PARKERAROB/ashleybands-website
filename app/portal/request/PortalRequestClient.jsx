"use client";

import { useState } from "react";

export default function PortalRequestClient() {
  const [form, setForm] = useState({
    guardianName: "",
    guardianEmail: "",
    guardianPhone: "",
    studentFirst: "",
    studentLast: "",
    studentGrade: "",
    instrumentOrNote: ""
  });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/portal/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error || "Could not submit the request.");
      return;
    }
    setStatus("sent");
    setMessage("Check your email for a confirmation link. Mr. Parker will review the request after the email is verified.");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel portal-panel-wide">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Request Profile Access</h1>
        <p className="portal-copy">
          Use this when your email is new or not connected to the right student yet. You will verify the email first, then Mr. Parker will review the student connection.
        </p>
        <form className="portal-request-form" onSubmit={submit}>
          <label>
            <span>Guardian name</span>
            <input value={form.guardianName} onChange={(event) => update("guardianName", event.target.value)} required />
          </label>
          <label>
            <span>Guardian email</span>
            <input type="email" value={form.guardianEmail} onChange={(event) => update("guardianEmail", event.target.value)} required />
          </label>
          <label>
            <span>Guardian phone</span>
            <input value={form.guardianPhone} onChange={(event) => update("guardianPhone", event.target.value)} />
          </label>
          <label>
            <span>Student first name</span>
            <input value={form.studentFirst} onChange={(event) => update("studentFirst", event.target.value)} required />
          </label>
          <label>
            <span>Student last name</span>
            <input value={form.studentLast} onChange={(event) => update("studentLast", event.target.value)} required />
          </label>
          <label>
            <span>Student grade</span>
            <input value={form.studentGrade} onChange={(event) => update("studentGrade", event.target.value)} placeholder="Rising 9th" />
          </label>
          <label className="portal-request-wide">
            <span>Instrument or note</span>
            <textarea value={form.instrumentOrNote} onChange={(event) => update("instrumentOrNote", event.target.value)} rows={4} />
          </label>
          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : "Send confirmation"}
          </button>
        </form>
        {message ? <p className={`portal-message ${status === "error" ? "error" : ""}`}>{message}</p> : null}
      </section>
    </main>
  );
}
