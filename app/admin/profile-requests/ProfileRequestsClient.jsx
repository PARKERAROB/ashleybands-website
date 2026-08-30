"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { revokeStaffSession } from "@/lib/staffSession";

const STORAGE_KEY = "bdos_staff_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function authHeaders() {
  return { "Content-Type": "application/json" };
}

function StaffLogin({ onAuthed }) {
  const [form, setForm] = useState({ email: "", pin: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/sponsors/staff-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Sign in failed.");
      return;
    }
    const session = { id: data.id, role: data.role, display_name: data.display_name };
    writeSession(session);
    onAuthed(session);
  }

  return (
    <form className="tracker-form tracker-form-narrow" onSubmit={submit}>
      <h2>Staff sign in</h2>
      <label className="tracker-field">
        <span>Email</span>
        <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      </label>
      <label className="tracker-field">
        <span>PIN</span>
        <input type="password" required value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })} />
      </label>
      {error ? <p className="tracker-error">{error}</p> : null}
      <button type="submit" className="sponsors-btn sponsors-btn-primary" disabled={busy}>
        {busy ? "Working..." : "Sign in"}
      </button>
    </form>
  );
}

export default function ProfileRequestsClient() {
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSession(readSession()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/admin/profile-requests", { headers: authHeaders(session) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      writeSession(null);
      setSession(null);
      return;
    }
    if (!res.ok) {
      setError(body.error || "Could not load requests.");
      return;
    }
    setData(body);
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function review(item, status) {
    setBusyId(item.id);
    setError("");
    const res = await fetch("/api/admin/profile-requests", {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ id: item.id, status, details: item.details })
    });
    const body = await res.json().catch(() => ({}));
    setBusyId("");
    if (!res.ok) {
      setError(body.error || "Could not review this request.");
      return;
    }
    await load();
  }

  if (!session) {
    return (
      <main className="portal-shell">
        <section className="portal-panel">
          <p className="eyebrow">Staff only</p>
          <h1>Profile Requests</h1>
          <StaffLogin onAuthed={setSession} />
        </section>
      </main>
    );
  }

  return (
    <main className="portal-shell">
      <section className="portal-panel portal-panel-wide">
        <header className="portal-admin-header">
          <div>
            <p className="eyebrow">Staff only</p>
            <h1>Profile Requests</h1>
            <p className="portal-copy">Family profile details apply immediately. Program participation changes remain pending here until staff approves or declines them.</p>
            <p className="portal-copy">Signed in as {session.display_name}</p>
          </div>
          <button
            type="button"
            className="sponsors-btn"
            onClick={async () => {
              if (!await revokeStaffSession()) return;
              setSession(null);
            }}
          >
            Log out
          </button>
        </header>
        {error ? <p className="portal-message error">{error}</p> : null}
        {!data ? <p className="portal-copy">Loading...</p> : null}
        {data ? (
          <div className="portal-review-list">
            {data.requests.length === 0 ? <p className="portal-copy">No profile requests yet.</p> : null}
            {data.requests.map((item) => (
              <article className="portal-review-card" key={item.id}>
                <div>
                  <p className="portal-label">{item.item_type.replaceAll("_", " ")}</p>
                  <h2>{item.summary}</h2>
                  <p className="portal-copy">
                    Status: {item.status} · Email alert: {item.email_alert_status}
                  </p>
                </div>
                {item.item_type === "participation_change" ? (
                  <>
                    <ParticipationComparison details={item.details} />
                    {item.status === "needs_review" ? (
                      <div className="portal-field-edit">
                        <button type="button" disabled={busyId === item.id} onClick={() => review(item, "approved")}>Approve and update record</button>
                        <button type="button" className="portal-link-btn" disabled={busyId === item.id} onClick={() => review(item, "rejected")}>Decline</button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <dl className="portal-detail-grid">
                    <div><dt>Guardian</dt><dd>{item.details?.guardian_name || item.portal_people?.display_name || "Not listed"}</dd></div>
                    <div><dt>Email</dt><dd>{item.details?.guardian_email || "Not listed"}</dd></div>
                    <div><dt>Phone</dt><dd>{item.details?.guardian_phone || "Not listed"}</dd></div>
                    <div><dt>Claimed student</dt><dd>{item.details?.claimed_student || item.portal_students?.display_name || "Not listed"}</dd></div>
                    <div><dt>Grade</dt><dd>{item.details?.student_grade || item.portal_students?.grade_fall26 || "Not listed"}</dd></div>
                    <div><dt>Match</dt><dd>{item.details?.match_confidence || "none"}</dd></div>
                  </dl>
                )}
              </article>
            ))}
          </div>
        ) : null}
        <p className="portal-footnote"><Link href="/sponsors/dashboard">Sponsorship dashboard</Link></p>
      </section>
    </main>
  );
}

const PARTICIPATION_LABELS = {
  bandPeriod: "Band period",
  ensemble: "Concert ensemble",
  concertInstrument: "Concert band instrument",
  marchingEnrollment: "Marching Band",
  marchingRole: "Marching role",
  marchingAssignment: "Marching assignment"
};

function ParticipationComparison({ details }) {
  const oldValue = details?.old_value || {};
  const requested = details?.requested_value || {};
  return (
    <>
      <dl className="portal-detail-grid">
        {Object.entries(PARTICIPATION_LABELS).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{oldValue[key] || "Not listed"} → <strong>{requested[key] || "Not applicable"}</strong></dd>
          </div>
        ))}
      </dl>
      {details?.family_note ? <p className="portal-copy"><strong>Family note:</strong> {details.family_note}</p> : null}
    </>
  );
}
