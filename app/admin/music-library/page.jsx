"use client";

import { useEffect, useState } from "react";

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
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "Login failed"); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    onAuthed(data);
  };
  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h2>Staff Login</h2>
      <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
      <input placeholder="PIN" type="password" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} />
      {err && <p style={{ color: "#e74c3c", fontSize: 13 }}>{err}</p>}
      <button onClick={login} style={{ ...btnStyle, marginTop: 12, width: "100%" }}>Sign In</button>
    </div>
  );
}

export default function AdminMusicLibraryPage() {
  const [session, setSession] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedSession = readSession();
      setSession(savedSession);
      setLoading(Boolean(savedSession));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch("/api/music-library/admin", { headers: authHeaders(session) })
      .then((r) => r.json()).then((d) => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [session]);

  const mark = async (id, status) => {
    const res = await fetch("/api/music-library/admin", {
      method: "PATCH", headers: authHeaders(session), body: JSON.stringify({ id, review_status: status })
    });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (!session) return <StaffLogin onAuthed={(s) => { setSession(s); setLoading(true); }} />;
  if (loading) return <div style={pageStyle}><p>Loading...</p></div>;

  const pending = items.filter((i) => i.review_status === "pending");

  return (
    <div style={pageStyle}>
      <h2>🎵 Music Library — Review</h2>
      <p style={{ color: "#555", fontSize: 14 }}>{pending.length} pending</p>

      {pending.length === 0 && <p style={{ color: "#999", marginTop: 20 }}>All caught up.</p>}

      {pending.map((item) => (
        <div key={item.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, margin: "12px 0" }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>&ldquo;{item.title}&rdquo;</div>
          {item.composer && <div style={{ fontSize: 14, color: "#555" }}>— {item.composer}</div>}
          <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
            Submitted by {item.submitted_by} · {new Date(item.submitted_at).toLocaleString()}
          </div>

          <table style={{ width: "100%", fontSize: 13, marginTop: 8, borderCollapse: "collapse" }}>
            <tbody>
              {item.ensemble_type && <tr><td style={tdStyle}>Type</td><td>{item.ensemble_type.replace(/_/g, " ")}</td></tr>}
              {item.publisher && <tr><td style={tdStyle}>Publisher</td><td>{item.publisher}</td></tr>}
              {item.publisher_grade && <tr><td style={tdStyle}>Grade</td><td>{item.publisher_grade}</td></tr>}
              {item.physical_location && <tr><td style={tdStyle}>Location</td><td>{item.physical_location}</td></tr>}
              {item.score_status && <tr><td style={tdStyle}>Score</td><td>{item.score_status}</td></tr>}
              {item.parts_status && <tr><td style={tdStyle}>Parts</td><td>{item.parts_status}</td></tr>}
              {item.missing_parts && <tr><td style={tdStyle}>Missing</td><td>{item.missing_parts}</td></tr>}
              {item.ready_to_use && <tr><td style={tdStyle}>Ready</td><td>{item.ready_to_use}</td></tr>}
              {item.condition_notes && <tr><td style={tdStyle}>Condition</td><td>{item.condition_notes}</td></tr>}
            </tbody>
          </table>

          {item.raw_transcript && (
            <details style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
              <summary>Raw transcript</summary>
              <p style={{ margin: "4px 0 0", fontStyle: "italic" }}>{item.raw_transcript}</p>
            </details>
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
