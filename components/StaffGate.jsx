"use client";

import { useState } from "react";
import { readStaffSession, saveStaffSession, clearStaffSession } from "@/lib/staffSession";

// Wraps any staff-only UI. Renders a login form until the staff member is
// authenticated, then calls children(session, signOut). Reuses the shared
// localStorage session so signing in once covers every admin dashboard.
export function StaffGate({ children }) {
  const [session, setSession] = useState(() => readStaffSession());

  if (!session) {
    return <StaffLogin onAuthed={setSession} />;
  }

  const signOut = () => {
    clearStaffSession();
    setSession(null);
  };

  return children(session, signOut);
}

export function StaffLogin({ onAuthed }) {
  const [form, setForm] = useState({ email: "", pin: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/sponsors/staff-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || "Login failed");
        return;
      }
      saveStaffSession(data);
      onAuthed(data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h2>Staff Login</h2>
      <input
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        style={loginInput}
      />
      <input
        placeholder="PIN"
        type="password"
        value={form.pin}
        onChange={(e) => setForm({ ...form, pin: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && login()}
        style={{ ...loginInput, marginTop: 8 }}
      />
      {err && <p style={{ color: "#e74c3c", fontSize: 13 }}>{err}</p>}
      <button onClick={login} disabled={busy} style={loginBtn}>{busy ? "Signing in…" : "Sign In"}</button>
    </div>
  );
}

const loginInput = { boxSizing: "border-box", width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const loginBtn = { marginTop: 12, width: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
