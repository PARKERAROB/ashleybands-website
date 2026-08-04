"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

function usd(cents) {
  return `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function countdown(reclaimAt) {
  if (!reclaimAt) return null;
  const ms = new Date(reclaimAt).getTime() - Date.now();
  if (ms <= 0) return "opening to the pool";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  return `${hours} hour${hours === 1 ? "" : "s"} left`;
}

export default function SponsorshipClient() {
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sponsors/portal-dashboard");
      if (res.status === 404) {
        setStatus("not_open");
        return;
      }
      if (res.status === 401) {
        setStatus("signed_out");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load sponsorship.");
        setStatus("error");
        return;
      }
      setData(json);
      setStatus("ready");
    } catch {
      setError("Could not load sponsorship.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="sp-shell">
      <div className="sp-wrap">
        <p className="sp-eyebrow">Bands of Ashley</p>
        <h1>Family Sponsorship</h1>

        {status === "loading" ? <p className="sp-muted">Opening…</p> : null}

        {status === "not_open" ? (
          <div className="sp-card">
            <p>The family sponsorship section opens soon. Check back after Mr. Parker sends the launch email.</p>
            <p className="sp-muted">
              <Link href="/portal/review">Back to your profile</Link>
            </p>
          </div>
        ) : null}

        {status === "signed_out" ? (
          <div className="sp-card">
            <p>Sign in to your Family Portal first, then come back here.</p>
            <p>
              <Link className="sp-btn sp-btn-primary" href="/portal">
                Go to the Family Portal
              </Link>
            </p>
          </div>
        ) : null}

        {status === "error" ? <p className="sp-error" role="alert">{error}</p> : null}

        {status === "ready" && data ? <Dashboard data={data} reload={load} /> : null}
      </div>
      <Styles />
    </main>
  );
}

function Dashboard({ data, reload }) {
  const goalPct = Math.min(100, Math.round((data.confirmedCents / data.goalCents) * 100));
  const count = data.prospects.length;
  const target = data.targetBusinessCount;
  const [showWarmed, setShowWarmed] = useState(false);

  return (
    <>
      <p className="sp-lede">
        Help fund the band so families never have to. Add three to five businesses your family already knows and
        loves. There is no obligation and no fee. We even break the ice for you.
      </p>

      <section className="sp-card sp-goal">
        <div className="sp-goal-head">
          <span>Your sponsorship total</span>
          <strong>{usd(data.confirmedCents)} of {usd(data.goalCents)}</strong>
        </div>
        <div className="sp-bar">
          <div className="sp-bar-fill" style={{ transform: `scaleX(${goalPct / 100})` }} />
        </div>
        <p className="sp-muted">
          {data.confirmedGifts > 0
            ? `${data.confirmedGifts} confirmed gift${data.confirmedGifts === 1 ? "" : "s"} so far. Thank you!`
            : "The $2,000 goal is aspirational — a stretch target, never a bill."}
        </p>
      </section>

      <section className="sp-progress-row">
        <span className={count >= target ? "sp-pill sp-pill-done" : "sp-pill"}>
          {count} of {target} businesses added
        </span>
        {count < target ? <span className="sp-muted">Aim for about five.</span> : <span className="sp-muted">Great start.</span>}
      </section>

      <h2>Your businesses</h2>
      {data.prospects.length ? (
        <div className="sp-list">
          {data.prospects.map((p) => (
            <ProspectCard key={p.id} prospect={p} reload={reload} />
          ))}
        </div>
      ) : (
        <p className="sp-muted">No businesses yet. Add your first one below.</p>
      )}

      <AddBusiness reload={reload} />

      <section className="sp-card">
        <div className="sp-card-head">
          <h2 style={{ margin: 0 }}>Don&apos;t have five of your own?</h2>
          <button type="button" className="sp-btn" onClick={() => setShowWarmed((s) => !s)}>
            {showWarmed ? "Hide" : `Browse warmed leads (${data.warmedAvailable})`}
          </button>
        </div>
        <p className="sp-muted">
          These are businesses that already told us they&apos;re open to hearing from an Ashley family. Claim one and it
          becomes yours for a week. You&apos;ll see how to reach them once you claim it.
        </p>
        {showWarmed ? <WarmedList reload={reload} /> : null}
      </section>

      <p className="sp-muted sp-foot">
        <Link href="/portal/review">← Back to your profile</Link>
      </p>
    </>
  );
}

function ProspectCard({ prospect, reload }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const claimed = prospect.lead_kind === "claimed_warm";
  const biz = prospect.business || {};
  const reclaimAt = biz.reclaim_at;
  const contacted = Boolean(prospect.contacted_at);
  const showTimer = claimed && !contacted && reclaimAt;

  async function patch(payload) {
    setBusy(true);
    try {
      await fetch(`/api/sponsors/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function warmFirst() {
    setBusy(true);
    try {
      await fetch("/api/sponsors/warm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospect.id })
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    setBusy(true);
    try {
      await fetch("/api/sponsors/claim", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: biz.id })
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/sponsors/prospects/${prospect.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function copyGiveLink() {
    if (!prospect.give_path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${prospect.give_path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(prospect.give_path, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <article className="sp-prospect">
      <div className="sp-prospect-head">
        <div>
          <h3>{biz.name_display || "Business"}</h3>
          {biz.category ? <span className="sp-muted">{biz.category}</span> : null}
        </div>
        {claimed ? <span className="sp-tag">Claimed lead</span> : null}
      </div>

      {showTimer ? (
        <div className="sp-timer">
          <strong>{countdown(reclaimAt)}</strong> to make contact, or it returns to the pool.
        </div>
      ) : null}

      {(prospect.contact_name || prospect.contact_email || prospect.contact_phone || prospect.business_address) ? (
        <ul className="sp-contact">
          {prospect.contact_name ? <li>Contact: {prospect.contact_name}</li> : null}
          {prospect.contact_phone ? <li>Call: {prospect.contact_phone}</li> : null}
          {prospect.contact_email ? <li>Email: {prospect.contact_email}</li> : null}
          {prospect.business_address ? <li>Visit: {prospect.business_address}</li> : null}
        </ul>
      ) : null}

      {prospect.give_path ? (
        <button type="button" className="sp-link" onClick={copyGiveLink}>
          {copied ? "Sponsor payment link copied" : "Copy sponsor payment link"}
        </button>
      ) : null}

      {contacted ? (
        <p className="sp-done">✓ You contacted them. It&apos;s in the program&apos;s hands now — thank you.</p>
      ) : (
        <div className="sp-actions">
          {!claimed ? (
            <div className="sp-mode">
              <span className="sp-muted">How do you want to reach them?</span>
              <div className="sp-mode-row">
                <button
                  type="button"
                  className={`sp-chip ${prospect.contact_mode === "self" ? "on" : ""}`}
                  disabled={busy}
                  onClick={() => patch({ contact_mode: "self" })}
                >
                  I&apos;ll go
                </button>
                <button
                  type="button"
                  className={`sp-chip ${prospect.contact_mode === "warm_first" ? "on" : ""}`}
                  disabled={busy}
                  onClick={warmFirst}
                >
                  Have the band email them first
                </button>
              </div>
              {prospect.contact_mode === "warm_first" ? (
                <span className="sp-muted">We&apos;ll send a friendly intro before you visit.</span>
              ) : null}
            </div>
          ) : null}

          <div className="sp-actions-row">
            <button type="button" className="sp-btn sp-btn-primary" disabled={busy} onClick={() => patch({ contacted: true })}>
              I contacted them
            </button>
            {claimed ? (
              <button type="button" className="sp-link" disabled={busy} onClick={release}>
                Release to pool
              </button>
            ) : (
              <button type="button" className="sp-link" disabled={busy} onClick={remove}>
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function AddBusiness({ reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_id: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    relationship_note: "",
    contact_mode: "self"
  });
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const debounce = useRef(null);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onNameChange(value) {
    update("business_name", value);
    update("business_id", "");
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sponsors/business-search?q=${encodeURIComponent(value.trim())}`);
        const json = await res.json().catch(() => ({}));
        setSuggestions(res.ok ? json.results || [] : []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  function pick(s) {
    update("business_name", s.name_display);
    update("business_id", s.id);
    setSuggestions([]);
  }

  async function submit(e) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    const res = await fetch("/api/sponsors/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("idle");
      setMessage(json.error || "Could not add. Add an email or phone so we can reach them.");
      return;
    }
    if (form.contact_mode === "warm_first" && json.prospect?.id) {
      await fetch("/api/sponsors/warm-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: json.prospect.id })
      });
    }
    setForm({
      business_name: "",
      business_id: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      relationship_note: "",
      contact_mode: "self"
    });
    setStatus("idle");
    setOpen(false);
    await reload();
  }

  if (!open) {
    return (
      <button type="button" className="sp-btn sp-btn-primary sp-add" onClick={() => setOpen(true)}>
        + Add a business
      </button>
    );
  }

  return (
    <form className="sp-card sp-form" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Add a business your family knows</h2>
      <p className="sp-muted">
        A storefront you visit, or the place a parent works. Skip any business that doesn&apos;t allow employees or
        families to solicit.
      </p>

      <label>
        Business name
        <input
          value={form.business_name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Flaming Amy's Burrito Barn"
          required
        />
      </label>
      {suggestions.length ? (
        <ul className="sp-suggest">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)}>
                {s.name_display}
                {s.city ? <span className="sp-muted"> · {s.city}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="sp-grid2">
        <label>
          Contact name (if you know it)
          <input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
        </label>
        <label>
          Phone
          <input value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
        </label>
      </div>
      <label>
        Email
        <input type="email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} />
      </label>
      <label>
        How does your family know them? (optional)
        <input value={form.relationship_note} onChange={(e) => update("relationship_note", e.target.value)} />
      </label>

      <div className="sp-mode">
        <span className="sp-muted">When you&apos;re ready to reach out:</span>
        <div className="sp-mode-row">
          <button
            type="button"
            className={`sp-chip ${form.contact_mode === "self" ? "on" : ""}`}
            onClick={() => update("contact_mode", "self")}
          >
            I&apos;ll go myself
          </button>
          <button
            type="button"
            className={`sp-chip ${form.contact_mode === "warm_first" ? "on" : ""}`}
            onClick={() => update("contact_mode", "warm_first")}
          >
            Have the band email them first
          </button>
        </div>
      </div>

      {message ? <p className="sp-error" role="alert">{message}</p> : null}
      <div className="sp-actions-row">
        <button type="submit" className="sp-btn sp-btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Adding…" : "Add business"}
        </button>
        <button type="button" className="sp-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function WarmedList({ reload }) {
  const [results, setResults] = useState(null);
  const [q, setQ] = useState("");
  const [claiming, setClaiming] = useState("");
  const [message, setMessage] = useState("");
  const debounce = useRef(null);

  const fetchList = useCallback(async (query) => {
    try {
      const res = await fetch(`/api/sponsors/warmed-list?q=${encodeURIComponent(query || "")}`);
      const json = await res.json().catch(() => ({}));
      setResults(res.ok ? json.results || [] : []);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => fetchList(""), 0);
    return () => window.clearTimeout(timer);
  }, [fetchList]);

  function onSearch(value) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchList(value), 250);
  }

  async function claim(id) {
    setClaiming(id);
    setMessage("");
    try {
      const res = await fetch("/api/sponsors/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: id })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error || "Could not claim that lead.");
        await fetchList(q);
        return;
      }
      await reload();
      await fetchList(q);
    } finally {
      setClaiming("");
    }
  }

  return (
    <div className="sp-warmed">
      <input className="sp-search" placeholder="Search warmed leads…" value={q} onChange={(e) => onSearch(e.target.value)} />
      {message ? <p className="sp-error" role="alert">{message}</p> : null}
      {results === null ? (
        <p className="sp-muted">Loading…</p>
      ) : results.length === 0 ? (
        <p className="sp-muted">No warmed leads available right now.</p>
      ) : (
        <ul className="sp-warmed-list">
          {results.map((b) => (
            <li key={b.id}>
              <div>
                <strong>{b.name_display}</strong>
                <span className="sp-muted">
                  {b.category ? ` · ${b.category}` : ""}
                  {b.distance_mi != null ? ` · ${b.distance_mi} mi` : ""}
                </span>
              </div>
              <button type="button" className="sp-btn" disabled={claiming === b.id} onClick={() => claim(b.id)}>
                {claiming === b.id ? "Claiming…" : "Claim"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .sp-shell {
        max-width: 760px;
        margin: 0 auto;
        padding: 28px 18px 80px;
        color: #20160f;
      }
      .sp-wrap h1 {
        margin: 2px 0 10px;
        font-size: 30px;
      }
      .sp-eyebrow {
        text-transform: uppercase;
        letter-spacing: 2px;
        font-size: 12px;
        color: #7b1829;
        font-weight: 700;
        margin: 0;
      }
      .sp-lede {
        font-size: 16px;
        line-height: 1.55;
        color: #3a2f26;
      }
      .sp-card {
        background: #fff;
        border: 1px solid #ece3d6;
        border-radius: 12px;
        padding: 18px;
        margin: 16px 0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      }
      .sp-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      .sp-goal-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 10px;
      }
      .sp-bar {
        height: 12px;
        background: #f0e9dd;
        border-radius: 8px;
        overflow: hidden;
      }
      .sp-bar-fill {
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #b8893b, #d8b46a);
        transform-origin: left center;
        transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .sp-progress-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin: 6px 0 4px;
      }
      .sp-pill {
        background: #f3ece0;
        border-radius: 14px;
        padding: 5px 12px;
        font-size: 14px;
        font-weight: 600;
      }
      .sp-pill-done {
        background: #e4f0e2;
        color: #2f7a2f;
      }
      .sp-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .sp-prospect {
        background: #fff;
        border: 1px solid #ece3d6;
        border-radius: 12px;
        padding: 16px;
      }
      .sp-prospect-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      .sp-prospect-head h3 {
        margin: 0 0 2px;
        font-size: 18px;
      }
      .sp-tag {
        background: #7b1829;
        color: #fff;
        border-radius: 12px;
        padding: 3px 10px;
        font-size: 12px;
        font-weight: 700;
        height: fit-content;
        white-space: nowrap;
      }
      .sp-timer {
        background: #fbf3e3;
        border: 1px solid #ecd9ad;
        border-radius: 8px;
        padding: 8px 12px;
        margin: 10px 0;
        font-size: 14px;
      }
      .sp-contact {
        list-style: none;
        padding: 0;
        margin: 10px 0;
        font-size: 14px;
        color: #3a2f26;
      }
      .sp-contact li {
        padding: 2px 0;
      }
      .sp-done {
        color: #2f7a2f;
        font-weight: 600;
        margin: 10px 0 0;
      }
      .sp-actions {
        margin-top: 10px;
      }
      .sp-actions-row {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 12px;
        flex-wrap: wrap;
      }
      .sp-mode-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 6px 0;
      }
      .sp-chip {
        border: 1px solid #c9bba6;
        background: #fff;
        border-radius: 18px;
        padding: 7px 14px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        color: #3a2f26;
        min-height: 44px;
      }
      .sp-chip.on {
        background: #7b1829;
        border-color: #7b1829;
        color: #fff;
      }
      .sp-btn {
        border: 1px solid #7b1829;
        background: #fff;
        color: #7b1829;
        border-radius: 8px;
        padding: 9px 16px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
      }
      .sp-btn-primary {
        background: #7b1829;
        color: #fff;
      }
      .sp-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .sp-add {
        margin: 6px 0 18px;
      }
      .sp-link {
        background: none;
        border: none;
        color: #7b1829;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 0;
        font-size: 14px;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
      }
      .sp-form label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin: 12px 0 0;
      }
      .sp-form input {
        width: 100%;
        min-height: 44px;
        box-sizing: border-box;
        margin-top: 5px;
        padding: 10px 12px;
        border: 1px solid #cabfad;
        border-radius: 8px;
        font-size: 15px;
      }
      .sp-grid2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      @media (max-width: 520px) {
        .sp-grid2 {
          grid-template-columns: 1fr;
        }
      }
      .sp-suggest {
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
        border: 1px solid #ece3d6;
        border-radius: 8px;
        overflow: hidden;
      }
      .sp-suggest button {
        width: 100%;
        text-align: left;
        background: #fff;
        border: none;
        border-bottom: 1px solid #f0e9dd;
        padding: 9px 12px;
        cursor: pointer;
        font-size: 14px;
      }
      .sp-suggest button:hover {
        background: #faf6ee;
      }
      .sp-search {
        width: 100%;
        min-height: 44px;
        box-sizing: border-box;
        padding: 9px 12px;
        border: 1px solid #cabfad;
        border-radius: 8px;
        font-size: 15px;
        margin: 10px 0;
      }
      .sp-warmed-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sp-warmed-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        border: 1px solid #f0e9dd;
        border-radius: 8px;
        padding: 10px 12px;
      }
      .sp-muted {
        color: #6f675a;
        font-size: 14px;
      }
      .sp-error {
        color: #7b1829;
        font-weight: 600;
      }
      .sp-foot {
        margin-top: 24px;
      }
      .sp-shell a:not(.sp-btn) {
        color: #7b1829;
      }
      @media (prefers-reduced-motion: reduce) {
        .sp-bar-fill {
          transition: none;
        }
      }
    `}</style>
  );
}
