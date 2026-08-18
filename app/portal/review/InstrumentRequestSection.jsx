"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PortalSectionIcon from "./PortalSectionIcon";

export default function InstrumentRequestSection({ student }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    studentSignature: student.displayName || "",
    guardianSignature: "",
    responsibilityAccepted: false
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/instrument-request")
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) setMessage(body.error || "Could not load the instrument agreement.");
        else setRecord((body.requests || []).find((item) => item.student_id === student.id) || null);
      })
      .catch(() => !cancelled && setMessage("Could not load the instrument agreement."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [student.id]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/portal/instrument-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, ...form })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(body.error || "Could not submit the agreement.");
      else {
        setRecord({ ...body.request, status: "submitted", student_id: student.id });
        setMessage("Submitted. Mr. Parker will add the assigned instrument information.");
      }
    } catch {
      setMessage("Could not submit the agreement. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-workspace-section" aria-labelledby="instrument-request-heading">
      <div className="portal-section-heading">
        <PortalSectionIcon type="instrument" />
        <div className="portal-section-heading-copy">
          <h2 id="instrument-request-heading">County instrument</h2>
          <p>Complete this only if {student.displayName} needs to borrow a school-owned instrument.</p>
        </div>
      </div>

      {loading ? <p className="portal-muted-status">Checking agreement status…</p> : null}
      {record ? (
        <div className="portal-field">
          <span className="portal-field-label">Agreement received</span>
          <span className="portal-field-value">
            {record.status === "assigned" && record.assignment?.instrument_type
              ? `${record.assignment.instrument_type}${record.assignment.brand ? ` — ${record.assignment.brand}` : ""}`
              : "Submitted; instrument assignment pending"}
          </span>
          {record.assignment?.asset_id || record.assignment?.serial_number ? (
            <span className="portal-field-note">
              {record.assignment.asset_id ? `School asset ${record.assignment.asset_id}` : ""}
              {record.assignment.asset_id && record.assignment.serial_number ? " · " : ""}
              {record.assignment.serial_number ? `Serial ${record.assignment.serial_number}` : ""}
            </span>
          ) : null}
        </div>
      ) : !loading ? (
        <form className="portal-form" onSubmit={submit}>
          <p className="portal-copy">
            NHCS provides this instrument in good playing condition. The student and family agree to care for it,
            return it in the condition issued, and accept responsibility for costs resulting from damage or loss.
          </p>
          <label>
            Student signature
            <input required value={form.studentSignature} onChange={(event) => setForm({ ...form, studentSignature: event.target.value })} />
          </label>
          <label>
            Parent/guardian signature
            <input required value={form.guardianSignature} onChange={(event) => setForm({ ...form, guardianSignature: event.target.value })} />
          </label>
          <label className="portal-consent-note">
            <input
              type="checkbox"
              required
              checked={form.responsibilityAccepted}
              onChange={(event) => setForm({ ...form, responsibilityAccepted: event.target.checked })}
            />
            I have read and agree to the instrument care, return, damage, and loss responsibilities above.
          </label>
          <button type="submit" className="portal-action-link" disabled={busy}>
            {busy ? "Submitting…" : "Submit instrument agreement"}
          </button>
        </form>
      ) : null}
      {message ? <p className="portal-muted-status">{message}</p> : null}
      <p className="portal-footnote">
        <Link href={`/portal/band-ready/forms?studentId=${encodeURIComponent(student.id)}`}>Return to Band Ready forms</Link>
      </p>
    </section>
  );
}
