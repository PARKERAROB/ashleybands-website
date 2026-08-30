"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bdos_staff_session_v1";

function readSession() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
  catch { return null; }
}

function authHeaders() {
  return { "Content-Type": "application/json" };
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
    if (!res.ok) { setErr(data.error || "Login failed"); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    onAuthed(data);
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h2>Staff Login</h2>
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
        style={inputStyle} />
      <input placeholder="PIN" type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })}
        style={{ ...inputStyle, marginTop: 8 }} />
      {err && <p style={{ color: "#e74c3c", fontSize: 13 }}>{err}</p>}
      <button onClick={login} style={{ ...btnStyle, marginTop: 12, width: "100%" }}>Sign In</button>
    </div>
  );
}

export default function AdminInventoryPage() {
  const [session, setSession] = useState(() => readSession());
  const [items, setItems] = useState([]);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [connectedAssets, setConnectedAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch("/api/instrument-inventory/admin", { headers: authHeaders(session) })
      .then((r) => r.json())
      .then((d) => { setItems(d.items || []); setEligibleStudents(d.eligibleStudents || []); setConnectedAssets(d.connectedAssets || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [session]);

  const mark = async (id, status) => {
    const res = await fetch(`/api/instrument-inventory/admin`, {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ id, review_status: status })
    });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const assign = async (event, id) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const res = await fetch("/api/instrument-inventory/admin", {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ id, action: "assign", ...values })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(body.error || "Could not assign the instrument.");
      return;
    }
    setEligibleStudents((previous) => previous.filter((item) => item.id !== values.requestId));
    setItems((previous) => previous.map((item) => item.id === id ? { ...item, instrument_request_id: values.requestId } : item));
  };

  const linkAsset = async (event, id) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!window.confirm("Match this observation to the selected connected instrument?")) return;
    const res = await fetch("/api/instrument-inventory/admin", {
      method: "PATCH",
      headers: authHeaders(session),
      body: JSON.stringify({ id, action: "link", canonicalAssetId: values.canonicalAssetId })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { window.alert(body.error || "Could not match the instrument."); return; }
    setItems((previous) => previous.map((item) => item.id === id ? { ...item, canonical_asset_id: body.canonicalAssetId } : item));
  };

  if (!session) return <StaffLogin onAuthed={(s) => { setSession(s); setLoading(true); }} />;

  if (loading) return <div style={pageStyle}><p>Loading...</p></div>;

  const pending = items.filter((i) => i.review_status === "pending");

  return (
    <div style={pageStyle}>
      <h2>🎺 Instrument Inventory — Review</h2>
      <p style={{ color: "#555", fontSize: 14 }}>{pending.length} pending · {items.length - pending.length} reviewed</p>
      <p style={{ color: "#555", fontSize: 14 }}>
        {eligibleStudents.length} student{eligibleStudents.length === 1 ? " has" : "s have"} a signed county instrument agreement and await assignment.
      </p>

      {pending.length === 0 && <p style={{ color: "#999", marginTop: 20 }}>All caught up.</p>}

      {pending.map((item) => (
        <div key={item.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, margin: "12px 0" }}>
          <div style={{ fontWeight: 600 }}>
            {item.asset_id ? `${item.asset_id} — ` : ""}{item.instrument_type} — {item.brand || "unknown brand"}
          </div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            Submitted by {item.submitted_by} · {new Date(item.submitted_at).toLocaleString()}
          </div>
          <table style={{ width: "100%", fontSize: 13, marginTop: 8, borderCollapse: "collapse" }}>
            <tbody>
              {item.asset_id && <tr><td style={tdStyle}>Asset ID</td><td>{item.asset_id}</td></tr>}
              {item.serial_number && <tr><td style={tdStyle}>Serial</td><td>{item.serial_number}</td></tr>}
              {item.model_markings && <tr><td style={tdStyle}>Model</td><td>{item.model_markings}</td></tr>}
              {item.finish && <tr><td style={tdStyle}>Finish</td><td>{item.finish}</td></tr>}
              {item.locker && <tr><td style={tdStyle}>Locker</td><td>{item.locker}</td></tr>}
              {item.location && <tr><td style={tdStyle}>Location</td><td>{item.location}</td></tr>}
              {item.repair_needed && <tr><td style={tdStyle}>Repair Needed</td><td>{item.repair_needed}</td></tr>}
              {item.repair_priority && <tr><td style={tdStyle}>Repair Priority</td><td>{item.repair_priority}</td></tr>}
              {item.condition_notes && <tr><td style={tdStyle}>Condition</td><td>{item.condition_notes}</td></tr>}
              {item.visible_damage && <tr><td style={tdStyle}>Damage</td><td>{item.visible_damage}</td></tr>}
              {item.missing_parts && <tr><td style={tdStyle}>Missing</td><td>{item.missing_parts}</td></tr>}
              <tr><td style={tdStyle}>Plays</td><td>{item.plays || "?"}</td></tr>
              <tr><td style={tdStyle}>Case</td><td>{item.case_present || "?"}</td></tr>
              <tr><td style={tdStyle}>Mouthpiece</td><td>{item.mouthpiece_present || "?"}</td></tr>
            </tbody>
          </table>
          {item.raw_transcript && (
            <details style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
              <summary>Raw transcript</summary>
              <p style={{ margin: "4px 0 0", fontStyle: "italic" }}>{item.raw_transcript}</p>
            </details>
          )}
          {!item.instrument_request_id && item.canonical_asset_id ? (
            <form onSubmit={(event) => assign(event, item.id)} style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                Assign to student with signed form
                <select name="requestId" required defaultValue="" style={{ ...inputStyle, marginTop: 5 }}>
                  <option value="" disabled>Select student…</option>
                  {eligibleStudents.map((agreement) => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreement.portal_students?.display_name || "Student"} · grade {agreement.portal_students?.grade_fall26 || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                Condition when issued
                <select name="issuedCondition" required defaultValue="good" style={{ ...inputStyle, marginTop: 5 }}>
                  <option value="new">New</option><option value="excellent">Excellent</option>
                  <option value="good">Good</option><option value="fair">Fair</option>
                </select>
              </label>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
                Assignment notes
                <textarea name="assignmentNotes" rows={2} style={{ ...inputStyle, marginTop: 5 }} />
              </label>
              <button disabled={!eligibleStudents.length} style={{ ...btnStyle, background: "#7b1829", marginTop: 10 }}>
                Assign this instrument
              </button>
            </form>
          ) : item.instrument_request_id ? (
            <p style={{ fontSize: 13, fontWeight: 600, color: "#2c7a4b", marginTop: 12 }}>Assigned to signed student</p>
          ) : (
            <form onSubmit={(event) => linkAsset(event, item.id)} style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                Match to connected instrument
                <select name="canonicalAssetId" required defaultValue="" style={{ ...inputStyle, marginTop: 5 }}>
                  <option value="" disabled>Select the verified asset…</option>
                  {connectedAssets.map((asset) => {
                    const instrument = Array.isArray(asset.asset_instruments) ? asset.asset_instruments[0] : asset.asset_instruments;
                    return <option key={asset.id} value={asset.id}>{[asset.asset_tag, instrument?.instrument_type, instrument?.brand, instrument?.serial_number].filter(Boolean).join(" · ")}</option>;
                  })}
                </select>
              </label>
              <p style={{ fontSize: 12, color: "#775b16" }}>Choose only after the asset tag, serial, type, and brand have been reviewed.</p>
              <button disabled={!connectedAssets.length} style={{ ...btnStyle, background: "#775b16" }}>Save verified match</button>
            </form>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => mark(item.id, "verified")} style={{ ...btnStyle, background: "#2ecc71" }}>✅ Verified</button>
            <button onClick={() => mark(item.id, "rejected")} style={{ ...btnStyle, background: "#e74c3c" }}>🗑️ Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const pageStyle = { maxWidth: 700, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" };
const inputStyle = { boxSizing: "border-box", width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const btnStyle = { padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" };
const tdStyle = { padding: "2px 8px 2px 0", fontWeight: 600, color: "#555", whiteSpace: "nowrap", verticalAlign: "top" };
