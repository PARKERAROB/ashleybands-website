"use client";

import { useState } from "react";
import styles from "./packet.module.css";

// Screen-only controls. Printing is a person's choice; "Mark as printed" is a separate step.
export default function PacketControls({ letterId, version, status, viewer, backHref, previewMode }) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markPrinted() {
    setBusy(true);
    setError("");
    const url = viewer === "staff" ? `/api/admin/carnegie-letters/${letterId}` : `/api/portal/carnegie-notes/letters/${letterId}`;
    const response = await fetch(url, {
      method: viewer === "staff" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_printed", version })
    }).catch(() => null);
    const json = await response?.json().catch(() => ({}));
    setBusy(false);
    if (!response?.ok) return setError(json?.error || "That did not save. Try again.");
    setCurrent(json.letter.status);
  }

  return (
    <div className={styles.controls}>
      {previewMode ? <p className={styles.previewNote}>Staff preview. Families cannot see this page yet.</p> : null}
      <p className={styles.controlsHint}>Print both pages, two-sided if you can: the letter on the front, the music notes on the back.</p>
      <div className={styles.controlsRow}>
        <button type="button" className={styles.printButton} onClick={() => window.print()}>Print this packet</button>
        {current === "approved" ? (
          <button type="button" className={styles.markButton} disabled={busy} onClick={markPrinted}>Mark as printed</button>
        ) : <span className={styles.controlsState}>Status: {current === "printed" ? "Printed" : current === "delivery_reported" ? "Delivery reported" : "Approved for print"}</span>}
        <a href={backHref} className={styles.backLink}>Back</a>
      </div>
      {error ? <p className={styles.controlsError} role="alert">{error}</p> : null}
    </div>
  );
}
