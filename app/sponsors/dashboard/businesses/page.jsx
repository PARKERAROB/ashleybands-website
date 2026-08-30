"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { revokeStaffSession } from "@/lib/staffSession";
import {
  COLD_EMAIL_SUBJECT,
  renderColdEmailHTML
} from "@/lib/businessOutreachEmail";

const STORAGE_KEY = "bdos_staff_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function authHeaders() {
  return { "Content-Type": "application/json" };
}

const STATUS_OPTIONS = ["untested", "asked", "willing", "declined", "silent", "already-sponsor", "skip"];
const ZONE_OPTIONS = ["carolina-beach", "mid-corridor", "north-17th", "out-of-area"];
const SORT_OPTIONS = [
  { key: "name", label: "Business" },
  { key: "zone", label: "Zone" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Web" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "prior", label: "Prior" },
  { key: "enriched", label: "Enriched" },
  { key: "last_outreach", label: "Last outreach" }
];

function EmailPreview({ business }) {
  if (!business) return null;
  const yesUrl = `https://ashleybands.com/sponsors/respond?t=<TOKEN>&a=yes`;
  const noUrl = `https://ashleybands.com/sponsors/respond?t=<TOKEN>&a=no`;
  const html = renderColdEmailHTML({
    businessName: business.name_display,
    contactFirst: business.contact_person ? business.contact_person.split(/\s+/)[0] : "",
    yesUrl,
    noUrl
  });
  return (
    <div className="biz-preview">
      <div className="biz-preview-header">
        <div><strong>To:</strong> {business.email || <span style={{color:'#a00'}}>NO EMAIL</span>}</div>
        <div><strong>Subject:</strong> {COLD_EMAIL_SUBJECT}</div>
      </div>
      <div className="biz-preview-body" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="biz-preview-note">
        Token placeholder shown. Each real send generates unique click-yes / click-no URLs per outreach row.
      </p>
    </div>
  );
}

function EditRow({ business, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...business });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await onSave(draft); } finally { setBusy(false); }
  }
  return (
    <tr className="biz-row-editing">
      <td colSpan={8}>
        <div className="biz-edit-grid">
          <label className="tracker-field"><span>Name</span>
            <input value={draft.name_display || ""} onChange={(e) => setDraft({ ...draft, name_display: e.target.value })} />
          </label>
          <label className="tracker-field"><span>Email</span>
            <input value={draft.email || ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </label>
          <label className="tracker-field"><span>Contact person</span>
            <input value={draft.contact_person || ""} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} />
          </label>
          <label className="tracker-field"><span>Phone</span>
            <input value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </label>
          <label className="tracker-field"><span>Website</span>
            <input value={draft.website || ""} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
          </label>
          <label className="tracker-field"><span>Address</span>
            <input value={draft.address || ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </label>
          <label className="tracker-field"><span>Zone</span>
            <select value={draft.zone || ""} onChange={(e) => setDraft({ ...draft, zone: e.target.value })}>
              <option value="">—</option>
              {ZONE_OPTIONS.map(z => <option key={z}>{z}</option>)}
            </select>
          </label>
          <label className="tracker-field"><span>Status</span>
            <select value={draft.outreach_status} onChange={(e) => setDraft({ ...draft, outreach_status: e.target.value })}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="tracker-check">
            <input type="checkbox" checked={!!draft.prior_sponsor} onChange={(e) => setDraft({ ...draft, prior_sponsor: e.target.checked })} />
            <span>Prior sponsor</span>
          </label>
          <label className="tracker-field tracker-field-wide"><span>Notes</span>
            <input value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </label>
        </div>
        <div className="tracker-edit-actions">
          <button type="button" className="sponsors-btn sponsors-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
          <button type="button" className="sponsors-btn" onClick={onCancel}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function SendQueuePanel({ session, askedCount }) {
  const [queued, setQueued] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/sponsors/businesses/send-queue", { headers: authHeaders(session) });
      if (res.ok) {
        const body = await res.json();
        setQueued(body.queued);
      }
    } catch {
      // leave count as-is
    }
  }, [session]);

  // Refetch when the queued count likely changed (a queue/unqueue flips asked count).
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadCount(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadCount, askedCount]);

  async function send() {
    if (!queued) return;
    if (!confirm(`Send the cold willingness email to ${queued} business${queued === 1 ? "" : "es"} now? This emails real businesses.`)) {
      return;
    }
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/sponsors/businesses/send-queue", {
        method: "POST",
        headers: authHeaders(session),
        body: JSON.stringify({ confirm: true })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Send failed");
      setResult(`Sent ${body.sent}. Failed ${body.failed}. Remaining ${body.remaining}.`);
      loadCount();
    } catch (err) {
      setResult(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!queued) {
    return result ? <p className="biz-queue-note">{result}</p> : null;
  }

  return (
    <p className="biz-queue-note">
      <strong>{queued} email{queued === 1 ? "" : "s"} queued and ready to send.</strong>{" "}
      <button type="button" className="sponsors-btn sponsors-btn-primary" onClick={send} disabled={busy}>
        {busy ? "Sending..." : `Send queued (${queued})`}
      </button>
      {" "}Sends through Resend on ashleybands.com. You are the one clicking send.
      {result && <span style={{ display: "block", marginTop: 6 }}>{result}</span>}
    </p>
  );
}

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const nextDir = active && sort.dir === "asc" ? "desc" : "asc";
  return (
    <button
      type="button"
      className={`biz-sort-header${active ? " biz-sort-header-active" : ""}`}
      onClick={() => onSort(sortKey, nextDir)}
      aria-label={`Sort by ${label} ${nextDir === "asc" ? "ascending" : "descending"}`}
    >
      <span>{label}</span>
      <span className="biz-sort-mark">{active ? (sort.dir === "asc" ? "up" : "down") : ""}</span>
    </button>
  );
}

function BusinessRow({ session, business, onChange, onDelete, onPreview }) {
  const [editing, setEditing] = useState(false);

  async function quickStatus(newStatus) {
    const res = await fetch(`/api/sponsors/businesses/${business.id}`, {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ outreach_status: newStatus })
    });
    if (res.ok) {
      const { business: updated } = await res.json();
      onChange(updated);
    } else alert("Failed to update status");
  }

  async function queueSend() {
    const res = await fetch(`/api/sponsors/businesses/${business.id}/queue-send`, {
      method: "POST",
      headers: authHeaders(session)
    });
    if (res.ok) {
      // simple: just mark locally as 'asked' so the row updates
      onChange({ ...business, outreach_status: "asked" });
    } else {
      const body = await res.json();
      alert(`Could not queue: ${body.error}`);
    }
  }

  async function unqueue() {
    const res = await fetch(`/api/sponsors/businesses/${business.id}/queue-send`, {
      method: "DELETE",
      headers: authHeaders(session)
    });
    if (res.ok) onChange({ ...business, outreach_status: "untested" });
    else alert("Could not unqueue");
  }

  async function save(draft) {
    const res = await fetch(`/api/sponsors/businesses/${business.id}`, {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify(draft)
    });
    if (res.ok) {
      const { business: updated } = await res.json();
      onChange(updated);
      setEditing(false);
    } else alert("Failed to save");
  }

  async function del() {
    if (!confirm(`Permanently delete ${business.name_display}?`)) return;
    const res = await fetch(`/api/sponsors/businesses/${business.id}`, {
      method: "DELETE",
      headers: authHeaders(session)
    });
    if (res.ok) onDelete(business.id);
  }

  if (editing) {
    return <EditRow business={business} onSave={save} onCancel={() => setEditing(false)} />;
  }

  const statusClass = `biz-row-${business.outreach_status}`;
  return (
    <tr className={`biz-row ${statusClass}`}>
      <td>
        <strong>{business.name_display}</strong>
        {business.prior_sponsor && <span className="biz-tag biz-tag-prior">prior</span>}
        {business.family_count > 0 && (
          <span
            className="biz-tag"
            title="A family is already working this business in the tracker — avoid cold-emailing on top of an in-person visit"
            style={{ background: "#e6f0ff", color: "#1d4ed8" }}
          >
            {business.family_count} family{business.family_count === 1 ? "" : " families"}
          </span>
        )}
        {business.category && <div className="tracker-sub">{business.category}</div>}
        {business.notes && <div className="biz-note">{business.notes}</div>}
      </td>
      <td>{business.zone || "—"}</td>
      <td>
        {business.email ? <a href={`mailto:${business.email}`}>{business.email}</a> : <span className="biz-missing">—</span>}
        {business.contact_person && <div className="tracker-sub">{business.contact_person}</div>}
      </td>
      <td>{business.phone || "—"}</td>
      <td>
        {business.website ? <a href={business.website} target="_blank" rel="noreferrer">link</a> : "—"}
      </td>
      <td className="biz-source">{business.source || "—"}</td>
      <td><span className={`biz-status biz-status-${business.outreach_status}`}>{business.outreach_status}</span></td>
      <td className="biz-actions">
        <button type="button" className="tracker-link" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="tracker-link" onClick={() => onPreview(business)}>Preview</button>
        {business.outreach_status === "untested" && business.email && (
          <button type="button" className="tracker-link tracker-link-action" onClick={queueSend}>Queue send</button>
        )}
        {business.outreach_status === "asked" && (
          <button type="button" className="tracker-link" onClick={unqueue}>Unqueue</button>
        )}
        {business.outreach_status === "untested" && !business.email && (
          <span className="biz-missing" title="Add an email before queueing">no email</span>
        )}
        {business.outreach_status !== "skip" && business.outreach_status !== "asked" && (
          <button type="button" className="tracker-link" onClick={() => quickStatus("skip")}>Skip</button>
        )}
        {business.outreach_status === "skip" && (
          <button type="button" className="tracker-link" onClick={() => quickStatus("untested")}>Unskip</button>
        )}
        <button type="button" className="tracker-link tracker-link-danger" onClick={del}>Del</button>
      </td>
    </tr>
  );
}

function Dashboard({ session, onLogout }) {
  const [data, setData] = useState({ businesses: [], totals: {} });
  const [filter, setFilter] = useState({ zone: "", status: "untested", source: "", q: "" });
  const [sort, setSort] = useState({ key: "", dir: "asc" });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
      if (sort.key) {
        params.set("sort", sort.key);
        params.set("dir", sort.dir);
      }
      const res = await fetch(`/api/sponsors/businesses?${params}`, { headers: authHeaders(session) });
      if (res.status === 401) { onLogout(); return; }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [session, filter, sort, onLogout]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const t = data.totals;
  function updateSort(key, dir) {
    setSort({ key, dir });
  }

  return (
    <div className="dashboard">
      <header className="tracker-header">
        <div>
          <p className="eyebrow">Business Prospect Curation</p>
          <h2>{session.display_name} <span className="dashboard-role">({session.role})</span></h2>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Link href="/sponsors/dashboard" className="sponsors-btn">← Family tracker dashboard</Link>
          <button type="button" className="sponsors-btn" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <div className="tracker-stats">
        <div className="tracker-stat"><span className="tracker-stat-num">{t.count || 0}</span><span className="tracker-stat-label">Shown</span></div>
        <div className="tracker-stat"><span className="tracker-stat-num">{t.with_email || 0}</span><span className="tracker-stat-label">With email</span></div>
        <div className="tracker-stat"><span className="tracker-stat-num">{(t.by_status && t.by_status.asked) || 0}</span><span className="tracker-stat-label">Queued to send</span></div>
        <div className="tracker-stat"><span className="tracker-stat-num">{(t.by_status && t.by_status.willing) || 0}</span><span className="tracker-stat-label">Willing</span></div>
        <div className="tracker-stat"><span className="tracker-stat-num">{(t.by_status && t.by_status.declined) || 0}</span><span className="tracker-stat-label">Declined</span></div>
        <div className="tracker-stat"><span className="tracker-stat-num">{t.prior || 0}</span><span className="tracker-stat-label">Prior sponsors</span></div>
      </div>
      <SendQueuePanel session={session} askedCount={(t.by_status && t.by_status.asked) || 0} />

      <div className="dashboard-filters">
        <label className="tracker-field"><span>Zone</span>
          <select value={filter.zone} onChange={(e) => setFilter({ ...filter, zone: e.target.value })}>
            <option value="">All zones</option>
            {ZONE_OPTIONS.map(z => <option key={z}>{z}</option>)}
          </select>
        </label>
        <label className="tracker-field"><span>Status</span>
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="tracker-field"><span>Source</span>
          <select value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}>
            <option value="">All sources</option>
            <option value="osm">OSM</option>
            <option value="manual:athletics-prior-2025">Athletics 2025</option>
            <option value="manual:hub-prior">Prior band sponsor</option>
            <option value="manual:bdos-history">BDOS history</option>
          </select>
        </label>
        <label className="tracker-field"><span>Search name</span>
          <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="contains..." />
        </label>
        <label className="tracker-field"><span>Sort by</span>
          <select value={sort.key} onChange={(e) => setSort({ key: e.target.value, dir: sort.dir })}>
            <option value="">Default: prior, zone, name</option>
            {SORT_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label className="tracker-field"><span>Direction</span>
          <select value={sort.dir} onChange={(e) => setSort({ ...sort, dir: e.target.value })} disabled={!sort.key}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      {error && <p className="tracker-error">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && (
        <div className="tracker-table-wrap">
          <table className="tracker-table biz-table">
            <thead>
              <tr>
                <th><SortHeader label="Business" sortKey="name" sort={sort} onSort={updateSort} /></th>
                <th><SortHeader label="Zone" sortKey="zone" sort={sort} onSort={updateSort} /></th>
                <th><SortHeader label="Email" sortKey="email" sort={sort} onSort={updateSort} /></th>
                <th><SortHeader label="Phone" sortKey="phone" sort={sort} onSort={updateSort} /></th>
                <th><SortHeader label="Web" sortKey="website" sort={sort} onSort={updateSort} /></th>
                <th><SortHeader label="Source" sortKey="source" sort={sort} onSort={updateSort} /></th>
                <th><SortHeader label="Status" sortKey="status" sort={sort} onSort={updateSort} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.businesses.map(b => (
                <BusinessRow
                  key={b.id}
                  session={session}
                  business={b}
                  onChange={(u) => setData({ ...data, businesses: data.businesses.map(x => x.id === u.id ? u : x) })}
                  onDelete={(id) => setData({ ...data, businesses: data.businesses.filter(x => x.id !== id) })}
                  onPreview={setPreview}
                />
              ))}
            </tbody>
          </table>
          {data.businesses.length === 0 && <p className="tracker-empty">No businesses match filters.</p>}
        </div>
      )}

      {preview && (
        <div className="biz-preview-modal" onClick={() => setPreview(null)}>
          <div className="biz-preview-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="biz-preview-close" onClick={() => setPreview(null)}>×</button>
            <h3>Cold-willingness email preview</h3>
            <p className="tracker-sub">This is exactly what {preview.name_display} would receive if we sent today.</p>
            <EmailPreview business={preview} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BusinessCurationPage() {
  const [session, setSession] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSession(readSession());
      setMounted(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!mounted) return null;

  async function logout() {
    if (!await revokeStaffSession()) return;
    setSession(null);
  }

  if (!session) {
    return (
      <main className="sponsors-page">
        <section className="sponsors-hero">
          <h1>Business Prospect Dashboard</h1>
          <p className="sponsors-lede">
            Staff only. <Link href="/sponsors/dashboard">Sign in on the main dashboard first</Link>, then return here.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <p className="eyebrow">Staff only</p>
        <h1>Business Prospect Curation</h1>
        <p className="sponsors-lede">
          Review the 200+ candidate businesses. Edit emails/contacts, mark obvious skips, preview
          the cold-willingness email per row, queue the ones to contact, then send the queue from
          here. Sends go out through Resend on ashleybands.com, on your click.
        </p>
      </section>
      <section className="sponsors-section">
        <Dashboard session={session} onLogout={logout} />
      </section>
    </main>
  );
}
