"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { revokeStaffSession } from "@/lib/staffSession";

const STORAGE_KEY = "bdos_staff_session_v1";

const STATUS_LABELS = {
  signed_up: "Signed up",
  mb_info: "Needs signup link",
  band_only: "Band only",
  out: "Out",
  talk: "Talk with Parker",
  needs_clarification: "Clarify",
  no_response: "No response"
};

const STATUS_OPTIONS = [
  "signed_up",
  "mb_info",
  "band_only",
  "out",
  "talk",
  "needs_clarification",
  "no_response"
];

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

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatusPill({ status, source }) {
  return (
    <span className={`mb-status-pill mb-status-${status}`}>
      {STATUS_LABELS[status] || status}
      {source === "manual" ? <span>manual</span> : null}
    </span>
  );
}

function StudentRow({ row, session, onSaved }) {
  const [status, setStatus] = useState(row.currentStatus);
  const [notes, setNotes] = useState(row.manualNotes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(row.currentStatus);
    setNotes(row.manualNotes || "");
  }, [row]);

  const dirty = status !== row.currentStatus || notes !== (row.manualNotes || "");

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/marching-band", {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({
        sourceStudentId: row.sourceStudentId,
        status,
        notes
      })
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || "Could not save.");
      return;
    }
    onSaved(row.sourceStudentId, body.override);
  }

  return (
    <tr className={`mb-row mb-row-${row.currentStatus}`}>
      <td>
        <strong>{row.displayName}</strong>
        <div className="tracker-sub">{row.grade || "No grade"}{row.signup?.instrument ? ` · ${row.signup.instrument}` : ""}</div>
        <div className="tracker-sub">{row.schoolEmail || row.sourceStudentId}</div>
      </td>
      <td>
        <StatusPill status={row.currentStatus} source={row.source} />
        {row.derivedStatus !== row.currentStatus ? (
          <div className="tracker-sub">Raw signal: {STATUS_LABELS[row.derivedStatus] || row.derivedStatus}</div>
        ) : null}
      </td>
      <td>
        {row.signup ? (
          <>
            <strong>{formatDate(row.signup.submittedAt)}</strong>
            <div className="tracker-sub">{row.signup.fundingPath || "No funding path"}</div>
            {row.signup.knownConflicts ? <div className="mb-note">Conflict: {row.signup.knownConflicts}</div> : null}
            {row.signup.questions ? <div className="mb-note">Question: {row.signup.questions}</div> : null}
          </>
        ) : <span className="tracker-sub mb-empty-cell">No form</span>}
      </td>
      <td>
        {row.latestClick ? (
          <>
            <strong>{STATUS_LABELS[row.latestClick.action] || row.latestClick.action}</strong>
            <div className="tracker-sub">{formatDate(row.latestClick.createdAt)}</div>
            {row.latestClick.note ? <div className="mb-note">{row.latestClick.note}</div> : null}
          </>
        ) : <span className="tracker-sub mb-empty-cell">No click</span>}
      </td>
      <td>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={`Move ${row.displayName}`}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{STATUS_LABELS[option]}</option>
          ))}
        </select>
      </td>
      <td>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Manual note"
          rows={2}
        />
        {row.manualUpdatedAt ? (
          <div className="tracker-sub">Saved {formatDate(row.manualUpdatedAt)} by {row.manualUpdatedBy || "staff"}</div>
        ) : null}
        {error ? <div className="tracker-error">{error}</div> : null}
      </td>
      <td>
        <button type="button" className="sponsors-btn sponsors-btn-primary" onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving..." : dirty ? "Save" : "Saved"}
        </button>
      </td>
    </tr>
  );
}

export default function MarchingBandAdminClient() {
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ status: "", search: "" });

  useEffect(() => {
    setSession(readSession());
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setError("");
    const res = await fetch("/api/admin/marching-band", { headers: authHeaders(session) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      writeSession(null);
      setSession(null);
      return;
    }
    if (!res.ok) {
      setError(body.error || "Could not load marching band dashboard.");
      return;
    }
    setData(body);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  function updateOverride(sourceStudentId, override) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) => {
          if (row.sourceStudentId !== sourceStudentId) return row;
          return {
            ...row,
            currentStatus: override.status,
            source: "manual",
            manualNotes: override.notes || "",
            manualUpdatedAt: override.updated_at,
            manualUpdatedBy: override.updated_by_name
          };
        })
      };
    });
    load();
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const term = filter.search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (filter.status && row.currentStatus !== filter.status) return false;
      if (!term) return true;
      return [
        row.displayName,
        row.grade,
        row.schoolEmail,
        row.signup?.instrument,
        row.manualNotes
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [data, filter]);

  if (!session) {
    return (
      <main className="portal-shell">
        <section className="portal-panel">
          <p className="eyebrow">Staff only</p>
          <h1>Marching Band Dashboard</h1>
          <StaffLogin onAuthed={setSession} />
        </section>
      </main>
    );
  }

  return (
    <main className="mb-admin">
      <section className="mb-admin-inner">
        <header className="portal-admin-header">
          <div>
            <p className="eyebrow">Staff only</p>
            <h1>Marching Band Dashboard</h1>
            <p className="portal-copy">Signed in as {session.display_name}</p>
          </div>
          <div className="mb-admin-actions">
            <button type="button" className="sponsors-btn" onClick={load}>Refresh</button>
            <button type="button" className="sponsors-btn" onClick={async () => { if (await revokeStaffSession()) setSession(null); }}>
              Log out
            </button>
          </div>
        </header>

        {error ? <p className="portal-message error">{error}</p> : null}
        {data?.migrationRequired ? (
          <p className="portal-message error">Manual moves need migration 0007 applied in Supabase before saves will work.</p>
        ) : null}
        {data?.usingFallbackOverrides ? (
          <p className="portal-message">Manual moves are saving through the existing review queue until migration 0007 is applied.</p>
        ) : null}

        {!data ? <p className="portal-copy">Loading...</p> : null}
        {data ? (
          <>
            <div className="tracker-stats mb-stats">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`tracker-stat mb-stat-btn${filter.status === status ? " mb-stat-btn-active" : ""}`}
                  onClick={() => setFilter({ ...filter, status: filter.status === status ? "" : status })}
                >
                  <span className="tracker-stat-num">{data.totals[status] || 0}</span>
                  <span className="tracker-stat-label">{STATUS_LABELS[status]}</span>
                </button>
              ))}
              <div className="tracker-stat">
                <span className="tracker-stat-num">{data.totals.manual}</span>
                <span className="tracker-stat-label">Manual moves</span>
              </div>
            </div>

            <div className="dashboard-filters">
              <label className="tracker-field">
                <span>Search</span>
                <input value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.target.value })} placeholder="Student, grade, instrument, note" />
              </label>
              <label className="tracker-field">
                <span>Status</span>
                <select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}>
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="tracker-table-wrap">
              <table className="tracker-table mb-admin-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Current</th>
                    <th>Signup form</th>
                    <th>Latest click</th>
                    <th>Move to</th>
                    <th>Manual note</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <StudentRow key={row.sourceStudentId} row={row} session={session} onSaved={updateOverride} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="portal-footnote">
              Showing {rows.length} of {data.totals.total} active students. <Link href="/admin/marching-band/funding">Roster and funding</Link> · <Link href="/admin/profile-requests">Profile requests</Link> · <Link href="/sponsors/dashboard">Sponsorship dashboard</Link>
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
