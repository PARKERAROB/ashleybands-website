"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "bdos_staff_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(s) {
  if (typeof window === "undefined") return;
  if (!s) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function authHeaders(s) {
  return { "Content-Type": "application/json", "x-staff-id": s.id, "x-staff-token": s.token };
}

const STATUS_LABELS = {
  pending: "Pending",
  yes: "Yes",
  no: "No",
  later: "Ask later"
};

function StaffLogin({ onAuthed }) {
  const [form, setForm] = useState({ email: "", pin: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sponsors/staff-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const s = { id: data.id, token: data.token, role: data.role, display_name: data.display_name };
      writeSession(s);
      onAuthed(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="tracker-form tracker-form-narrow" onSubmit={submit}>
      <h2>Staff sign in</h2>
      <label className="tracker-field">
        <span>Email</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label className="tracker-field">
        <span>PIN</span>
        <input
          type="password"
          required
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value })}
        />
      </label>
      {error && <p className="tracker-error">{error}</p>}
      <button type="submit" className="sponsors-btn sponsors-btn-primary" disabled={busy}>
        {busy ? "Working..." : "Sign in"}
      </button>
    </form>
  );
}

function Dashboard({ session, onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ family: "", status: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sponsors/dashboard", { headers: authHeaders(session) });
      if (res.status === 401) {
        writeSession(null);
        onLogout();
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body);
    } catch (err) {
      setError(err.message);
    }
  }, [session, onLogout]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <p className="tracker-error">{error}</p>;
  if (!data) return <p>Loading...</p>;

  const rows = data.prospects.filter((p) => {
    if (filter.family && p.family?.id !== filter.family) return false;
    if (filter.status && p.status !== filter.status) return false;
    return true;
  });

  return (
    <div className="dashboard">
      <header className="tracker-header">
        <div>
          <p className="eyebrow">Sponsorship Dashboard</p>
          <h2>{session.display_name} <span className="dashboard-role">({session.role})</span></h2>
        </div>
        <button type="button" className="sponsors-btn" onClick={() => { writeSession(null); onLogout(); }}>
          Log out
        </button>
      </header>

      <div className="tracker-stats">
        <div className="tracker-stat">
          <span className="tracker-stat-num">{data.families.length}</span>
          <span className="tracker-stat-label">Students enrolled</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">{data.totals.count}</span>
          <span className="tracker-stat-label">Businesses contacted</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">{data.totals.yes}</span>
          <span className="tracker-stat-label">Committed</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">${Math.round(data.totals.committed_amount).toLocaleString()}</span>
          <span className="tracker-stat-label">Raised</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">{data.totals.pending}</span>
          <span className="tracker-stat-label">Pending</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">{data.totals.later}</span>
          <span className="tracker-stat-label">Ask later</span>
        </div>
      </div>

      {data.dedup.length > 0 && (
        <section className="dashboard-alerts">
          <h3>⚠ Duplicate prospect alerts</h3>
          <p>Multiple students are pitching the same business. Coordinate before someone gets pitched twice. (Likely siblings if names match — that's expected.)</p>
          <ul>
            {data.dedup.map((d) => (
              <li key={d.business_id}>
                <strong>{d.name_display}</strong> — {d.family_count} students:{" "}
                {(d.families || []).join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dashboard-filters">
        <label className="tracker-field">
          <span>Filter by student</span>
          <select value={filter.family} onChange={(e) => setFilter({ ...filter, family: e.target.value })}>
            <option value="">All students</option>
            {data.families.map((f) => (
              <option key={f.id} value={f.id}>{f.display_name}</option>
            ))}
          </select>
        </label>
        <label className="tracker-field">
          <span>Filter by status</span>
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="later">Ask later</option>
          </select>
        </label>
      </div>

      <div className="tracker-table-wrap">
        <table className="tracker-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Business</th>
              <th>Status</th>
              <th>Dropped off</th>
              <th>Follow-up</th>
              <th>Committed</th>
              <th>Sent</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`tracker-row tracker-row-${p.status}`}>
                <td>
                  <strong>{p.family?.display_name}</strong>
                  {p.family?.section && <div className="tracker-sub">{p.family.section}</div>}
                </td>
                <td>
                  <strong>{p.business?.name_display}</strong>
                  {p.contact_name && <div className="tracker-sub">{p.contact_name}</div>}
                </td>
                <td>{STATUS_LABELS[p.status]}</td>
                <td>{p.dropped_off_at || "—"}</td>
                <td>{p.follow_up_at || p.ask_again_at || "—"}</td>
                <td>
                  {p.committed_amount
                    ? `$${Number(p.committed_amount).toLocaleString()}${p.committed_tier ? ` (${p.committed_tier})` : ""}`
                    : "—"}
                </td>
                <td>{p.sent_to_lead ? "✓" : "—"}</td>
                <td className="tracker-sub">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="tracker-empty">No prospects match your filter.</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [session, setSession] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <p className="eyebrow">Staff only</p>
        <h1>Sponsorship Dashboard</h1>
        <p className="sponsors-lede">
          Roll-up view of every family's prospect pipeline. Duplicate-prospect alerts flag when
          two families are pitching the same business.
        </p>
        <p className="sponsors-lede">
          <Link href="/sponsors">← Back to public hub</Link>
        </p>
      </section>

      <section className="sponsors-section">
        {!session && <StaffLogin onAuthed={setSession} />}
        {session && <Dashboard session={session} onLogout={() => setSession(null)} />}
      </section>
    </main>
  );
}
