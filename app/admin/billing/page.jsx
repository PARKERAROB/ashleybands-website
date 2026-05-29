"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bdos_staff_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function authHeaders(session) {
  return { "Content-Type": "application/json", "x-staff-id": session.id, "x-staff-token": session.token };
}

function usd(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

// "Last, First" from legal names, falling back to display_name.
function lastFirst(row) {
  const last = (row.legalLast || "").trim();
  const first = (row.preferredFirst || row.legalFirst || "").trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  return row.name || "";
}

// Sort key for "Last, First".
function lastNameKey(row) {
  return `${(row.legalLast || row.name || "").toLowerCase()} ${(row.legalFirst || "").toLowerCase()}`.trim();
}

// Pull the rising-grade number out of strings like "Rising 9th (current 8th)".
function gradeRank(grade) {
  const m = String(grade || "").match(/(\d{1,2})/);
  return m ? Number(m[1]) : 999;
}

function StaffLogin({ onAuthed }) {
  const [form, setForm] = useState({ email: "", pin: "" });
  const [err, setErr] = useState("");

  const login = async () => {
    setErr("");
    const res = await fetch("/api/sponsors/staff-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error || "Login failed");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    onAuthed(data);
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h2>Staff Login</h2>
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
      <input placeholder="PIN" type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} />
      {err && <p style={{ color: "#e74c3c", fontSize: 13 }}>{err}</p>}
      <button onClick={login} style={{ ...btnStyle, marginTop: 12, width: "100%", background: "#7b1829" }}>Sign In</button>
    </div>
  );
}

export default function AdminBillingPage() {
  const [session, setSession] = useState(() => readSession());
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [onlyBalance, setOnlyBalance] = useState(false);
  const [mbOnly, setMbOnly] = useState(false);
  const [sortBy, setSortBy] = useState("lastName");
  const [selected, setSelected] = useState({});
  const [msg, setMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admin/billing", { headers: authHeaders(session) });
    const data = await res.json().catch(() => ({}));
    setRoster(data.roster || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/billing", { headers: authHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        setRoster(d.roster || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = roster.filter((r) => {
      if (q && !lastFirst(r).toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
      if (onlyBalance && r.balanceCents <= 0) return false;
      if (mbOnly && !r.marchingBand) return false;
      return true;
    });
    const sorted = [...rows];
    if (sortBy === "grade") {
      sorted.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || lastNameKey(a).localeCompare(lastNameKey(b)));
    } else if (sortBy === "balance") {
      sorted.sort((a, b) => b.balanceCents - a.balanceCents || lastNameKey(a).localeCompare(lastNameKey(b)));
    } else {
      sorted.sort((a, b) => lastNameKey(a).localeCompare(lastNameKey(b)));
    }
    return sorted;
  }, [roster, query, onlyBalance, mbOnly, sortBy]);

  const totals = useMemo(() => {
    return roster.reduce(
      (acc, r) => {
        acc.charged += r.chargedCents;
        acc.paid += r.paidCents;
        acc.balance += r.balanceCents;
        return acc;
      },
      { charged: 0, paid: 0, balance: 0 }
    );
  }, [roster]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const exportCsv = async () => {
    const res = await fetch("/api/admin/billing/export", { headers: authHeaders(session) });
    if (!res.ok) {
      setMsg("Export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ashley-bands-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const syncMarchingBand = async () => {
    setSyncing(true);
    setMsg("");
    const res = await fetch("/api/admin/billing/sync-marching-band", {
      method: "POST",
      headers: authHeaders(session)
    });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) {
      setMsg(data.error || "Sync failed.");
      return;
    }
    const unmatched = data.unmatchedSignups
      ? ` · ${data.unmatchedSignups} signup(s) not matched to a student`
      : "";
    setMsg(`MB season fee: added ${data.inserted}, skipped ${data.skipped} already charged${unmatched}.`);
    load();
  };

  if (!session) return <StaffLogin onAuthed={(s) => { setSession(s); setLoading(true); }} />;
  if (loading) return <div style={pageStyle}><p>Loading...</p></div>;

  return (
    <div style={pageStyle}>
      <h2>💵 Student Billing</h2>
      <p style={{ color: "#555", fontSize: 14 }}>
        Charged {usd(totals.charged)} · Paid {usd(totals.paid)} · Outstanding {usd(totals.balance)}
      </p>

      <BulkCharge session={session} selectedIds={selectedIds} onDone={(m) => { setMsg(m); setSelected({}); load(); }} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <input placeholder="Search name..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...inputStyle, width: 200 }} />
        <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
          Sort:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            <option value="lastName">Last name (A–Z)</option>
            <option value="grade">Grade</option>
            <option value="balance">Balance (high→low)</option>
          </select>
        </label>
        <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={onlyBalance} onChange={(e) => setOnlyBalance(e.target.checked)} />
          Owes money only
        </label>
        <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={mbOnly} onChange={(e) => setMbOnly(e.target.checked)} />
          Marching band only
        </label>
        <button onClick={syncMarchingBand} disabled={syncing} style={{ ...btnStyle, background: "#7b1829" }}>
          {syncing ? "Applying…" : "Apply MB season fee to signups"}
        </button>
        <button onClick={exportCsv} style={{ ...btnStyle, background: "#245c73" }}>Export CSV</button>
      </div>
      {msg && <p style={{ color: "#446349", fontSize: 13 }}>{msg}</p>}

      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={thStyle}></th>
            <th style={thStyle}>Student</th>
            <th style={thStyle}>Grade</th>
            <th style={thStyle}>Charged</th>
            <th style={thStyle}>Paid</th>
            <th style={thStyle}>Sponsor</th>
            <th style={thStyle}>Balance</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <StudentRow
              key={r.id}
              row={r}
              session={session}
              checked={Boolean(selected[r.id])}
              onCheck={(v) => setSelected((prev) => ({ ...prev, [r.id]: v }))}
              onChanged={load}
            />
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p style={{ color: "#999", marginTop: 16 }}>No students match.</p>}
    </div>
  );
}

function StudentRow({ row, session, checked, onCheck, onChanged }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr style={{ borderBottom: "1px solid #eee" }}>
        <td style={tdStyle}><input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} /></td>
        <td style={tdStyle}>
          {lastFirst(row)}
          {row.marchingBand ? <span style={mbTagStyle}>MB</span> : null}
        </td>
        <td style={tdStyle}>{row.grade}</td>
        <td style={tdStyle}>{usd(row.chargedCents)}</td>
        <td style={tdStyle}>{usd(row.cashPaidCents)}</td>
        <td style={tdStyle}>{row.sponsorshipCents ? usd(row.sponsorshipCents) : "—"}</td>
        <td style={{ ...tdStyle, fontWeight: 700, color: row.balanceCents > 0 ? "#7b1829" : "#446349" }}>{usd(row.balanceCents)}</td>
        <td style={tdStyle}>
          <button onClick={() => setOpen((v) => !v)} style={{ ...btnStyle, background: "#6f675a", padding: "4px 10px" }}>{open ? "Close" : "Manage"}</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ padding: "8px 8px 16px", background: "#faf7ef" }}>
            <StudentManage studentId={row.id} session={session} onChanged={onChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function StudentManage({ studentId, session, onChanged }) {
  const [detail, setDetail] = useState(null);

  const load = async () => {
    const res = await fetch(`/api/admin/billing?studentId=${encodeURIComponent(studentId)}`, { headers: authHeaders(session) });
    const data = await res.json().catch(() => ({}));
    setDetail(data);
  };

  useEffect(() => {
    fetch(`/api/admin/billing?studentId=${encodeURIComponent(studentId)}`, { headers: authHeaders(session) })
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => {});
  }, [studentId, session]);

  if (!detail) return <p style={{ fontSize: 13 }}>Loading...</p>;

  const completed = (detail.payments || []).filter((p) => p.status === "completed");
  const sponsorshipCents = completed.filter((p) => p.method === "sponsorship").reduce((s, p) => s + (p.amount_cents || 0), 0);
  const cashPaidCents = completed.filter((p) => p.method !== "sponsorship").reduce((s, p) => s + (p.amount_cents || 0), 0);
  const balanceCents = Number(detail.balance?.balance_cents) || 0;

  const voidCharge = async (id) => {
    if (!window.confirm("Void this charge? It will be removed from the student's balance.")) return;
    const res = await fetch("/api/admin/billing/charges", {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      load();
      onChanged();
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
      <div style={{ minWidth: 280 }}>
        <p style={{ fontSize: 13, margin: "0 0 6px", fontWeight: 600 }}>
          Paid {usd(cashPaidCents)} · Sponsorship {usd(sponsorshipCents)} ·{" "}
          <span style={{ color: balanceCents > 0 ? "#7b1829" : "#446349" }}>Balance {usd(balanceCents)}</span>
        </p>
        <strong style={{ fontSize: 13 }}>Charges</strong>
        <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 13 }}>
          {(detail.charges || []).map((c) => (
            <li key={c.id} style={{ opacity: c.status === "void" ? 0.5 : 1 }}>
              {c.label || c.category} — {usd(c.amount_cents)} {c.status === "void" ? "(void)" : ""}
              {c.status === "active" ? (
                <button onClick={() => voidCharge(c.id)} style={{ ...linkBtnStyle, marginLeft: 6 }}>void</button>
              ) : null}
            </li>
          ))}
          {(detail.charges || []).length === 0 && <li style={{ color: "#999" }}>None</li>}
        </ul>
        <strong style={{ fontSize: 13 }}>Payments</strong>
        <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize: 13 }}>
          {(detail.payments || []).map((p) => (
            <li key={p.id} style={{ opacity: p.status === "completed" ? 1 : 0.5 }}>
              {usd(p.amount_cents)} — {p.method} ({p.status}) {p.notes ? `· ${p.notes}` : ""}
            </li>
          ))}
          {(detail.payments || []).length === 0 && <li style={{ color: "#999" }}>None</li>}
        </ul>
      </div>
      <RecordPayment studentId={studentId} session={session} onDone={() => { load(); onChanged(); }} />
    </div>
  );
}

function RecordPayment({ studentId, session, onDone }) {
  const [form, setForm] = useState({ amount: "", method: "check", notes: "" });
  const [status, setStatus] = useState("");

  const submit = async () => {
    setStatus("");
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!amountCents || amountCents <= 0) { setStatus("Enter an amount."); return; }
    const res = await fetch("/api/admin/billing/payments", {
      method: "POST",
      headers: authHeaders(session),
      body: JSON.stringify({ studentId, amountCents, method: form.method, notes: form.notes })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setStatus(data.error || "Failed."); return; }
    setStatus("Recorded.");
    setForm({ amount: "", method: "check", notes: "" });
    onDone();
  };

  return (
    <div style={{ minWidth: 240 }}>
      <strong style={{ fontSize: 13 }}>Record offline payment</strong>
      <input placeholder="Amount (USD)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, marginTop: 6 }} />
      <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={{ ...inputStyle, marginTop: 6 }}>
        <option value="check">Check</option>
        <option value="cash">Cash</option>
        <option value="credit">Credit</option>
        <option value="sponsorship">Sponsorship</option>
        <option value="adjustment">Adjustment</option>
      </select>
      <input placeholder="Notes (check #, etc.)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, marginTop: 6 }} />
      <button onClick={submit} style={{ ...btnStyle, marginTop: 8, background: "#446349" }}>Record</button>
      {status && <p style={{ fontSize: 12, marginTop: 4 }}>{status}</p>}
    </div>
  );
}

function BulkCharge({ session, selectedIds, onDone }) {
  const [form, setForm] = useState({ amount: "", label: "Marching Band 2026 season fee", category: "marching_band_2026", skip: true });
  const [status, setStatus] = useState("");

  const submit = async () => {
    setStatus("");
    if (!selectedIds.length) { setStatus("Select students first."); return; }
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!amountCents || amountCents <= 0) { setStatus("Enter an amount."); return; }
    const res = await fetch("/api/admin/billing/charges", {
      method: "POST",
      headers: authHeaders(session),
      body: JSON.stringify({ studentIds: selectedIds, amountCents, label: form.label, category: form.category, skipExistingCategory: form.skip })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setStatus(data.error || "Failed."); return; }
    onDone(`Charged ${data.inserted} student(s)${data.skipped ? `, skipped ${data.skipped} already charged` : ""}.`);
  };

  return (
    <div style={{ border: "1px solid #ded4bf", borderRadius: 8, padding: 12, background: "#fffaf0" }}>
      <strong style={{ fontSize: 14 }}>Assign a charge to selected students ({selectedIds.length})</strong>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Amount (USD)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, width: 140 }} />
        <input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} style={{ ...inputStyle, width: 280 }} />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, width: 180 }} />
        <label style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={form.skip} onChange={(e) => setForm({ ...form, skip: e.target.checked })} />
          Skip if already charged this category
        </label>
        <button onClick={submit} style={{ ...btnStyle, background: "#7b1829" }}>Assign charge</button>
      </div>
      {status && <p style={{ fontSize: 13, marginTop: 6 }}>{status}</p>}
    </div>
  );
}

const pageStyle = { maxWidth: 1000, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" };
const inputStyle = { boxSizing: "border-box", width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const btnStyle = { padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" };
const thStyle = { padding: "6px 8px", fontWeight: 700, color: "#555", fontSize: 12 };
const tdStyle = { padding: "6px 8px", verticalAlign: "top" };
const mbTagStyle = { marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: "#7b1829", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" };
const linkBtnStyle = { background: "none", border: "none", color: "#7b1829", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 };
