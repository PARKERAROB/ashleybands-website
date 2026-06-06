"use client";

// ============================================================================
// PREVIEW ONLY - not linked from anywhere, writes NOTHING.
// A faithful mock of the family "Fees & Payments" card (see
// app/portal/review/PortalReviewClient.jsx -> StudentFeeCard) with the new
// "apply my Spring Trip refund to marching band" flow added, so Rob can see and
// operate how it looks/feels before it ships for real. All state is local;
// clicking applies nothing to the database. Sample student: Charlotte Parker.
// Delete this route once the real feature is approved + built.
// ============================================================================

import { useState } from "react";

function usd(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

// --- sample data (fake; for preview only) -----------------------------------
const GOAL_CENTS = 50000;        // $500 season funding goal
const BASE_RAISED = 0;           // nothing raised yet
const REFUND_CONFIRMED = 24500;  // $245 confirmed now
const REFUND_TOPUP = 3500;       // +$35 if the final CharterUP check posts
const REFUND_MAX = REFUND_CONFIRMED + REFUND_TOPUP; // $280 best case

export default function ForgoDemoPage() {
  const [applied, setApplied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const raised = BASE_RAISED + (applied ? REFUND_CONFIRMED : 0);
  const remaining = Math.max(GOAL_CENTS - raised, 0);
  const tag = remaining > 0 ? `${usd(remaining)} to raise` : "All set";

  return (
    <main className="portal-shell">
      <section className="portal-panel portal-panel-wide">

        <div style={{ background: "#fff8e1", border: "1px solid #e6c34a", borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
          <strong>Preview only.</strong> This is a mock of how the family pay screen would look with the
          Spring Trip refund option. Tap anything you want — nothing here is saved. Sample student is
          Charlotte Parker with made-up numbers.
        </div>

        <p className="eyebrow">Ashley Bands</p>
        <h1>My Profile</h1>

        <div className="portal-profile">
          <section className="portal-section">
            <h2>Fees &amp; Payments</h2>

            <article className="portal-student-card">
              <div className="portal-student-head">
                <h3>Charlotte Parker</h3>
                <span className="portal-tag">{tag}</span>
              </div>

              <div className="portal-field">
                <span className="portal-field-label">2026 sign-ups</span>
                <span className="portal-field-value">Marching Band 2026 &#10003;</span>
              </div>

              <div className="portal-field">
                <span className="portal-field-label">Season funding</span>
                <span className="portal-field-value">
                  Goal {usd(GOAL_CENTS)} &middot; Raised {usd(raised)} &middot; Remaining {usd(remaining)}
                  {applied ? ` (includes ${usd(REFUND_CONFIRMED)} from your Spring Trip refund)` : ""}
                </span>
                <span className="portal-field-note">
                  This is our shared season goal, not a bill. Sponsorships and fundraising count toward it.
                </span>
              </div>

              {/* --- NEW: Spring Trip refund block --- */}
              <div
                className="portal-field"
                style={{ borderTop: "1px solid #eee", paddingTop: 14, marginTop: 6 }}
              >
                <span className="portal-field-label">Spring Trip 2026 refund</span>

                {applied ? (
                  <>
                    <span className="portal-field-value">
                      &#10003; Applied. {usd(REFUND_CONFIRMED)} is now counting toward Charlotte&rsquo;s
                      marching band funding goal.
                    </span>
                    <span className="portal-field-note">
                      If the final refund from the bus company clears, the remaining {usd(REFUND_TOPUP)} will
                      be applied too, for {usd(REFUND_MAX)} total. You will not receive a check for this amount.
                    </span>
                    <button
                      type="button"
                      className="portal-link-btn"
                      style={{ marginTop: 8, alignSelf: "flex-start" }}
                      onClick={() => setApplied(false)}
                    >
                      Undo (preview)
                    </button>
                  </>
                ) : (
                  <>
                    <span className="portal-field-value">
                      The May trip was cancelled and your family is owed a refund. You can have it sent back as
                      a check, or apply it toward Charlotte&rsquo;s marching band season instead.
                    </span>
                    <span className="portal-field-note">
                      Right now we can confirm {usd(REFUND_CONFIRMED)}. If the final refund from the bus company
                      clears, it rises to {usd(REFUND_MAX)}. Applying it means you forgo the refund check and we
                      credit that amount to your season funding goal.
                    </span>
                    <button
                      type="button"
                      style={{
                        marginTop: 10,
                        alignSelf: "flex-start",
                        background: "#7b1829",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "10px 16px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                      onClick={() => setConfirmOpen(true)}
                    >
                      Apply my refund to marching band
                    </button>
                  </>
                )}
              </div>

              <button type="button" style={{ marginTop: 14 }} disabled>
                Pay online (preview)
              </button>
            </article>
          </section>
        </div>
      </section>

      {/* --- confirm dialog --- */}
      {confirmOpen ? (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 10, padding: "22px 22px", maxWidth: 440, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Apply your Spring Trip refund?</h3>
            <p style={{ color: "#333", lineHeight: 1.5 }}>
              You are choosing to <strong>forgo your refund check</strong>. The boosters keep that amount and
              credit <strong>{usd(REFUND_CONFIRMED)}</strong>{" "}toward Charlotte&rsquo;s marching band funding
              goal (up to {usd(REFUND_MAX)} if the final bus-company refund clears). This cannot be sent back to
              you as cash once applied.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" className="portal-link-btn" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={{ background: "#7b1829", color: "#fff", border: "none", borderRadius: 6, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
                onClick={() => { setApplied(true); setConfirmOpen(false); }}
              >
                Yes, apply {usd(REFUND_CONFIRMED)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
