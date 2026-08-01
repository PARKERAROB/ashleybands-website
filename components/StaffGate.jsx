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
    // Clear the httpOnly cookie server-side, then the local display copy.
    fetch("/api/sponsors/staff-signout", { method: "POST" }).catch(() => {});
    clearStaffSession();
    setSession(null);
  };

  return children(session, signOut);
}

export function StaffLogin({ onAuthed }) {
  const [form, setForm] = useState({ email: "", pin: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async (event) => {
    event?.preventDefault();
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
    <form onSubmit={login} style={{ maxWidth: 400, margin: "100px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h2>Staff Login</h2>
      <label htmlFor="staff-email" style={loginLabel}>Email</label>
      <input
        id="staff-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        style={loginInput}
      />
      <label htmlFor="staff-pin" style={{ ...loginLabel, marginTop: 12 }}>PIN</label>
      <input
        id="staff-pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        required
        value={form.pin}
        onChange={(e) => setForm({ ...form, pin: e.target.value })}
        style={loginInput}
      />
      {err && <p style={{ color: "#a3242f", fontSize: 13 }} aria-live="polite">{err}</p>}
      <button type="submit" disabled={busy} style={loginBtn}>{busy ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}

const loginLabel = { display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700, color: "#4b584d" };
const loginInput = { boxSizing: "border-box", width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid #ccc", borderRadius: 6, fontFamily: "system-ui, sans-serif" };
const loginBtn = { marginTop: 12, width: "100%", padding: "10px 16px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 6, color: "#fff", background: "#7b1829", cursor: "pointer" };
