"use client";

import Link from "next/link";

// Email confirmation now happens with a 6-digit code on the request page itself,
// not a link. This page only catches stale magic-link clicks from old emails and
// points the family back to start over.
export default function PortalRequestConfirmClient() {
  return (
    <main className="portal-shell">
      <section className="portal-panel">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Email Confirmation</h1>
        <p className="portal-message">
          Email confirmation now uses a 6-digit code instead of a link. Start the request again and we&apos;ll email you a code to enter.
        </p>
        <p className="portal-footnote">
          <Link href="/portal/request">Request profile access</Link>
        </p>
      </section>
    </main>
  );
}
