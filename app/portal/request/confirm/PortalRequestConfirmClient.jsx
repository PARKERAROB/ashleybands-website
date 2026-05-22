"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function PortalRequestConfirmClient() {
  const [state, setState] = useState({ status: "loading", message: "Confirming your email..." });

  useEffect(() => {
    let cancelled = false;
    async function confirm() {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        setState({ status: "error", message: "Missing confirmation token." });
        return;
      }
      const res = await fetch("/api/portal/request/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setState({ status: "error", message: data.error || "This confirmation link could not be used." });
        return;
      }
      window.history.replaceState({}, "", "/portal/request/confirm");
      setState({
        status: "ready",
        message: "Your email is verified. Mr. Parker has been notified and will review the profile connection."
      });
    }
    confirm();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="portal-shell">
      <section className="portal-panel">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Email Confirmation</h1>
        <p className={`portal-message ${state.status === "error" ? "error" : ""}`}>{state.message}</p>
        <p className="portal-footnote">
          <Link href="/portal">Return to the family profile page</Link>
        </p>
      </section>
    </main>
  );
}
