"use client";

import { useEffect, useState } from "react";
import { readStaffSession, saveStaffSession, revokeStaffSession } from "@/lib/staffSession";
import styles from "./StaffGate.module.css";

const HELP_EMAIL = "robert.parker@nhcs.net";

// Friendlier wording for the sign-in errors people actually hit (#131). The request
// and response contract with /api/sponsors/staff-auth is unchanged.
function friendlySignInError(status, serverMessage) {
  if (status === 401) return "That email and PIN don't match. Check both and try again.";
  if (status === 400) return "Enter your email and your PIN.";
  if (status === 429) return "Too many tries. Wait a few minutes, then try again.";
  if (status === 503) return "Sign-in is down for a moment. Try again in a few minutes.";
  return serverMessage || "Sign-in didn't work. Try again.";
}

// Wraps any staff-only UI. Renders a login form until the staff member is
// authenticated, then calls children(session, signOut). Reuses the shared
// localStorage session so signing in once covers every admin dashboard.
export function StaffGate({ children }) {
  // Keep the server render and first browser render identical. localStorage is
  // browser-only; reading it in the state initializer causes a hydration
  // mismatch whenever an already-signed-in staff member opens an admin page.
  const [auth, setAuth] = useState({ ready: false, session: null });

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      setAuth({ ready: true, session: readStaffSession() });
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  if (!auth.ready) {
    return <p className={styles.loading}>Loading staff access…</p>;
  }

  const session = auth.session;

  if (!session) {
    return <StaffLogin onAuthed={(nextSession) => setAuth({ ready: true, session: nextSession })} />;
  }

  const signOut = async () => {
    // Keep the visible session until server-side revocation succeeds. This lets
    // the user retry instead of silently abandoning a still-valid cookie.
    if (!await revokeStaffSession()) return;
    setAuth({ ready: true, session: null });
  };

  return children(session, signOut);
}

export function StaffLogin({ onAuthed, title = "Staff sign-in", description }) {
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
        setErr(friendlySignInError(res.status, data.error));
        return;
      }
      saveStaffSession(data);
      onAuthed(data);
    } catch {
      setErr("We couldn't reach the sign-in server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={login} className={styles.form}>
      <h2>{title}</h2>
      <p className={styles.intro}>{description || "Staff and booster sign-in. Use the email and PIN Mr. Parker gave you."}</p>
      <label htmlFor="staff-email" className={styles.label}>Email</label>
      <input
        id="staff-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className={styles.input}
      />
      <label htmlFor="staff-pin" className={styles.label}>PIN</label>
      <input
        id="staff-pin"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        required
        value={form.pin}
        onChange={(e) => setForm({ ...form, pin: e.target.value })}
        className={styles.input}
      />
      {err && <p className={styles.error} aria-live="polite">{err}</p>}
      <button type="submit" disabled={busy} className={styles.button}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className={styles.help}>Forgot your PIN? Email Mr. Parker at <a href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a>.</p>
    </form>
  );
}
