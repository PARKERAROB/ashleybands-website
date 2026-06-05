"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "bdos_family_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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
  return { "Content-Type": "application/json", "x-family-id": s.id, "x-family-token": s.token };
}

async function endSession() {
  // Clears the httpOnly cookie server-side, then the local copy. Without the
  // server call the cookie would keep the session alive after "Log out".
  try {
    await fetch("/api/sponsors/family-signout", { method: "POST" });
  } catch {
    // ignore — still clear local state below
  }
  writeSession(null);
}

const STATUS_LABELS = {
  pending: "Pending",
  yes: "Yes — committed",
  no: "No — not this year",
  later: "Ask again later"
};

function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    display_name: "",
    pin: "",
    section: ""
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sponsors/family-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...form })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      const session = { id: data.id, token: data.token, display_name: data.display_name };
      writeSession(session);
      onAuthed(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tracker-auth">
      <div className="tracker-tabs">
        <button
          type="button"
          className={mode === "login" ? "tracker-tab tracker-tab-active" : "tracker-tab"}
          onClick={() => setMode("login")}
        >
          Log In
        </button>
        <button
          type="button"
          className={mode === "signup" ? "tracker-tab tracker-tab-active" : "tracker-tab"}
          onClick={() => setMode("signup")}
        >
          Sign Up
        </button>
      </div>
      <form className="tracker-form" onSubmit={submit}>
        <label className="tracker-field">
          <span>Student name</span>
          <input
            type="text"
            required
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="e.g., Sarah Smith"
          />
        </label>
        <label className="tracker-field">
          <span>4-digit PIN</span>
          <input
            type="password"
            required
            pattern="\d{4}"
            inputMode="numeric"
            maxLength={4}
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value })}
            placeholder="••••"
          />
        </label>
        {mode === "signup" && (
          <label className="tracker-field">
            <span>Section (e.g., trumpet, percussion, color guard)</span>
            <input
              type="text"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            />
          </label>
        )}
        {error && <p className="tracker-error">{error}</p>}
        <button type="submit" className="sponsors-btn sponsors-btn-primary" disabled={busy}>
          {busy ? "Working..." : mode === "signup" ? "Create Account" : "Log In"}
        </button>
        {mode === "login" && (
          <p className="tracker-help">
            Forgot your PIN? Email Mr. Parker at{" "}
            <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a> and he'll reset it.
          </p>
        )}
      </form>
    </div>
  );
}

const EMPTY_PROSPECT = { business_name: "", business_id: "", contact_name: "", contact_email: "", contact_phone: "", business_address: "", relationship_note: "" };

function AddProspectForm({ session, onAdded }) {
  const [form, setForm] = useState(EMPTY_PROSPECT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);

  // Typeahead against existing businesses so families reuse a record instead of
  // creating a near-duplicate of one already in the prospect DB.
  useEffect(() => {
    const q = form.business_name.trim();
    if (form.business_id || q.length < 2) {
      setSuggestions([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sponsors/business-search?q=${encodeURIComponent(q)}`, {
          headers: authHeaders(session)
        });
        if (!res.ok) return;
        const body = await res.json();
        if (active) setSuggestions(body.results || []);
      } catch {
        // ignore typeahead errors — free text still works
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [form.business_name, form.business_id, session]);

  function pickSuggestion(s) {
    setForm({ ...form, business_name: s.name_display, business_id: s.id });
    setSuggestions([]);
    setShowSuggest(false);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sponsors/prospects", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add");
      setForm(EMPTY_PROSPECT);
      onAdded(data.prospect);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="tracker-add" onSubmit={submit}>
      <h3>Add a business to your list</h3>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>
        Add an email or phone so we can reach them.
      </p>
      <div className="tracker-add-grid">
        <label className="tracker-field" style={{ position: "relative" }}>
          <span>Business name *</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={form.business_name}
            onChange={(e) => {
              // Typing after a pick means they're entering a different business.
              setForm({ ...form, business_name: e.target.value, business_id: "" });
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          />
          {form.business_id && (
            <span className="tracker-sub" style={{ color: "#2f7a2f" }}>
              Linked to an existing business — no duplicate created.
            </span>
          )}
          {showSuggest && suggestions.length > 0 && (
            <ul
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 20,
                margin: "2px 0 0",
                padding: 0,
                listStyle: "none",
                background: "#fff",
                border: "1px solid #ccc",
                borderRadius: 6,
                boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                maxHeight: 240,
                overflowY: "auto"
              }}
            >
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14
                    }}
                  >
                    {s.name_display}
                    {s.city ? <span style={{ color: "#888" }}> · {s.city}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label className="tracker-field">
          <span>Contact person</span>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
        </label>
        <label className="tracker-field">
          <span>Email</span>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            placeholder="owner@business.com"
          />
        </label>
        <label className="tracker-field">
          <span>Phone</span>
          <input
            type="tel"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            placeholder="(910) 555-1234"
          />
        </label>
        <label className="tracker-field tracker-field-wide">
          <span>Business address</span>
          <input
            type="text"
            value={form.business_address}
            onChange={(e) => setForm({ ...form, business_address: e.target.value })}
            placeholder="Street, city"
          />
        </label>
        <label className="tracker-field tracker-field-wide">
          <span>Your relationship (1 sentence)</span>
          <input
            type="text"
            value={form.relationship_note}
            onChange={(e) => setForm({ ...form, relationship_note: e.target.value })}
            placeholder="e.g., We've used this dentist for 10 years"
          />
        </label>
      </div>
      {error && <p className="tracker-error">{error}</p>}
      <button type="submit" className="sponsors-btn sponsors-btn-primary" disabled={busy}>
        {busy ? "Adding..." : "Add to list"}
      </button>
    </form>
  );
}

function ProspectRow({ session, prospect, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prospect);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const update = {
        status: draft.status,
        contact_name: draft.contact_name || null,
        contact_email: draft.contact_email || null,
        contact_phone: draft.contact_phone || null,
        business_address: draft.business_address || null,
        relationship_note: draft.relationship_note || null,
        dropped_off_at: draft.dropped_off_at || null,
        follow_up_at: draft.follow_up_at || null,
        ask_again_at: draft.ask_again_at || null,
        committed_amount: draft.committed_amount ? Number(draft.committed_amount) : null,
        committed_tier: draft.committed_tier || null,
        sent_to_lead: !!draft.sent_to_lead
      };
      const res = await fetch(`/api/sponsors/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: authHeaders(session),
        body: JSON.stringify(update)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.prospect);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${prospect.business?.name_display}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/sponsors/prospects/${prospect.id}`, {
      method: "DELETE",
      headers: authHeaders(session)
    });
    if (res.ok) onDelete(prospect.id);
    else alert("Delete failed");
    setBusy(false);
  }

  if (!editing) {
    return (
      <tr className={`tracker-row tracker-row-${prospect.status}`}>
        <td>
          <strong>{prospect.business?.name_display}</strong>
          {prospect.contact_name && <div className="tracker-sub">{prospect.contact_name}</div>}
          {(prospect.contact_email || prospect.contact_phone) && (
            <div className="tracker-sub">
              {[prospect.contact_email, prospect.contact_phone].filter(Boolean).join(" · ")}
            </div>
          )}
          {prospect.business_address && <div className="tracker-sub">{prospect.business_address}</div>}
          {prospect.relationship_note && (
            <div className="tracker-note">{prospect.relationship_note}</div>
          )}
        </td>
        <td>{STATUS_LABELS[prospect.status]}</td>
        <td>{prospect.dropped_off_at || "—"}</td>
        <td>{prospect.follow_up_at || prospect.ask_again_at || "—"}</td>
        <td>
          {prospect.committed_amount
            ? `$${Number(prospect.committed_amount).toLocaleString()}${
                prospect.committed_tier ? ` (${prospect.committed_tier})` : ""
              }`
            : "—"}
        </td>
        <td>{prospect.sent_to_lead ? "✓" : "—"}</td>
        <td>
          <button type="button" className="tracker-link" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="tracker-link tracker-link-danger" onClick={remove} disabled={busy}>
            Delete
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="tracker-row tracker-row-editing">
      <td colSpan={7}>
        <div className="tracker-edit-grid">
          <label className="tracker-field">
            <span>Status</span>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="yes">Yes — committed</option>
              <option value="no">No — not this year</option>
              <option value="later">Ask again later</option>
            </select>
          </label>
          <label className="tracker-field">
            <span>Contact person</span>
            <input
              type="text"
              value={draft.contact_name || ""}
              onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Email</span>
            <input
              type="email"
              value={draft.contact_email || ""}
              onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Phone</span>
            <input
              type="tel"
              value={draft.contact_phone || ""}
              onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })}
            />
          </label>
          <label className="tracker-field tracker-field-wide">
            <span>Business address</span>
            <input
              type="text"
              value={draft.business_address || ""}
              onChange={(e) => setDraft({ ...draft, business_address: e.target.value })}
            />
          </label>
          <label className="tracker-field tracker-field-wide">
            <span>Relationship note</span>
            <input
              type="text"
              value={draft.relationship_note || ""}
              onChange={(e) => setDraft({ ...draft, relationship_note: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Date dropped off</span>
            <input
              type="date"
              value={draft.dropped_off_at || ""}
              onChange={(e) => setDraft({ ...draft, dropped_off_at: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Follow-up date</span>
            <input
              type="date"
              value={draft.follow_up_at || ""}
              onChange={(e) => setDraft({ ...draft, follow_up_at: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Ask again later (date)</span>
            <input
              type="date"
              value={draft.ask_again_at || ""}
              onChange={(e) => setDraft({ ...draft, ask_again_at: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Committed amount ($)</span>
            <input
              type="number"
              min="0"
              step="50"
              value={draft.committed_amount || ""}
              onChange={(e) => setDraft({ ...draft, committed_amount: e.target.value })}
            />
          </label>
          <label className="tracker-field">
            <span>Tier (if committed)</span>
            <select
              value={draft.committed_tier || ""}
              onChange={(e) => setDraft({ ...draft, committed_tier: e.target.value })}
            >
              <option value="">—</option>
              <option value="Friend">Friend ($250)</option>
              <option value="Patron">Patron ($750)</option>
              <option value="Premier">Premier ($1,500)</option>
              <option value="Legacy">Legacy ($3,000+)</option>
              <option value="Adopt-an-Instrument">Adopt-an-Instrument</option>
            </select>
          </label>
          <label className="tracker-check">
            <input
              type="checkbox"
              checked={!!draft.sent_to_lead}
              onChange={(e) => setDraft({ ...draft, sent_to_lead: e.target.checked })}
            />
            <span>I've sent the form to Mr. Parker</span>
          </label>
        </div>
        <div className="tracker-edit-actions">
          <button type="button" className="sponsors-btn sponsors-btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </button>
          <button type="button" className="sponsors-btn" onClick={() => { setDraft(prospect); setEditing(false); }}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function TrackerDashboard({ session, onLogout }) {
  const [data, setData] = useState({ prospects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sponsors/prospects", { headers: authHeaders(session) });
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
    } finally {
      setLoading(false);
    }
  }, [session, onLogout]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data.prospects.length;
  const yesCount = data.prospects.filter((p) => p.status === "yes").length;
  const committed = data.prospects
    .filter((p) => p.status === "yes")
    .reduce((s, p) => s + (Number(p.committed_amount) || 0), 0);

  return (
    <div className="tracker-dashboard">
      <header className="tracker-header">
        <div>
          <p className="eyebrow">Signed in as</p>
          <h2>{session.display_name}</h2>
        </div>
        <button type="button" className="sponsors-btn" onClick={async () => { await endSession(); onLogout(); }}>
          Log out
        </button>
      </header>

      <div className="tracker-stats">
        <div className="tracker-stat">
          <span className="tracker-stat-num">{total}</span>
          <span className="tracker-stat-label">Businesses on your list</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">{yesCount}</span>
          <span className="tracker-stat-label">Committed</span>
        </div>
        <div className="tracker-stat">
          <span className="tracker-stat-num">${committed.toLocaleString()}</span>
          <span className="tracker-stat-label">Raised</span>
        </div>
      </div>
      <p className="tracker-help" style={{ marginTop: 4 }}>
        Everything you raise counts toward the program's shared season funding goal. It is not a
        personal account or a credit against a bill. We meet the goal together.
      </p>

      <AddProspectForm session={session} onAdded={(p) => setData({ ...data, prospects: [...data.prospects, p] })} />

      {loading && <p>Loading...</p>}
      {error && <p className="tracker-error">{error}</p>}

      {data.prospects.length > 0 && (
        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Dropped off</th>
                <th>Follow-up</th>
                <th>Committed</th>
                <th>Sent to Mr. Parker</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.prospects.map((p) => (
                <ProspectRow
                  key={p.id}
                  session={session}
                  prospect={p}
                  onChange={(updated) =>
                    setData({
                      ...data,
                      prospects: data.prospects.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
                    })
                  }
                  onDelete={(id) =>
                    setData({ ...data, prospects: data.prospects.filter((x) => x.id !== id) })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.prospects.length === 0 && !loading && (
        <p className="tracker-empty">
          No businesses yet. Add 5 from your warm list to get started. See the{" "}
          <Link href="/sponsors">family pitch guide and printable materials</Link> for help.
        </p>
      )}
    </div>
  );
}

export default function TrackerPage() {
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
        <p className="eyebrow">For families</p>
        <h1>Sponsorship Tracker</h1>
        <p className="sponsors-lede">
          Track your 5-business warm list, log drop-offs and follow-ups, and send committed
          sponsors straight to Mr. Parker.
        </p>
      </section>

      <section className="sponsors-section">
        {!session && <AuthForm onAuthed={setSession} />}
        {session && <TrackerDashboard session={session} onLogout={() => setSession(null)} />}
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">Need help</p>
        <p>
          New to this? See the <Link href="/sponsors">sponsorship hub</Link> for the family pitch
          guide, printable materials, and the full packet.
        </p>
      </section>
    </main>
  );
}
