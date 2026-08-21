"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import InstrumentRequestSection from "./InstrumentRequestSection";
import PortalSectionIcon from "./PortalSectionIcon";
import {
  BAND_PERIOD_OPTIONS,
  ENSEMBLE_OPTIONS,
  CONCERT_INSTRUMENT_OPTIONS,
  MARCHING_ENROLLMENT_OPTIONS,
  MARCHING_ROLE_OPTIONS,
  MARCHING_ASSIGNMENTS,
  optionsWithCurrent
} from "@/lib/participationOptions";

const SAVED_NOTE = "Saved. Your family record is updated.";

function initials(name) {
  return String(name || "Student")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function programValue(value, fallback = "Not listed") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function statusValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Not listed";
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}`;
}

function enrollmentValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "yes") return "Enrolled";
  if (normalized === "no") return "Not enrolled";
  if (normalized === "interested") return "Interested";
  if (normalized === "unknown") return "Not confirmed";
  return normalized ? value : "Not listed";
}

function formatUsd(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

let paypalSdkPromise = null;
function loadPaypalSdk(clientId) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.paypal) return Promise.resolve(window.paypal);
  if (paypalSdkPromise) return paypalSdkPromise;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      paypalSdkPromise = null;
      reject(new Error("Could not load PayPal."));
    };
    document.body.appendChild(script);
  });
  return paypalSdkPromise;
}

export default function PortalReviewClient() {
  const [state, setState] = useState({ status: "loading", message: "Opening your profile..." });
  const [profile, setProfile] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  async function loadProfile() {
    const res = await fetch("/api/portal/me");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState({ status: "error", message: data.error || "Profile access expired. Go to the sign-in page and request a new code." });
      return;
    }
    setProfile(data);
    const requestedStudentId = new URLSearchParams(window.location.search).get("studentId") || "";
    setSelectedStudentId((current) => current || ((data.students || []).some((student) => student.id === requestedStudentId) ? requestedStudentId : ""));
    setState({ status: "ready", message: "" });
  }

  useEffect(() => {
    let cancelled = false;
    // Sign-in happens on /portal (email -> 6-digit code), which sets the session
    // cookie before redirecting here. This page just loads the profile. A stray
    // ?token= from an old magic link is ignored.
    const params = new URLSearchParams(window.location.search);
    if (params.has("token")) {
      window.history.replaceState({}, "", "/portal/review");
    }
    const loadTimer = window.setTimeout(() => {
      if (!cancelled) loadProfile();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
    };
  }, []);

  const students = profile?.students || [];
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0] || null;

  return (
    <main className="portal-shell portal-review-shell">
      <section className="portal-family-page">
        <header className="portal-family-header">
          <div>
            <p className="eyebrow">Ashley Bands</p>
            <h1>Family Portal</h1>
            <p>
              Review your student&apos;s information, band participation, uniforms, and payments in one place.
            </p>
          </div>
          {profile ? (
            <p className="portal-account-summary">
              Signed in as <strong>{profile.person?.display_name || profile.email}</strong>
              <span>{profile.email}</span>
            </p>
          ) : null}
        </header>
        {state.status !== "ready" ? (
          <p className={`portal-message ${state.status === "error" ? "error" : ""}`}>{state.message}</p>
        ) : null}

        {profile && selectedStudent ? (
          <>
            {students.length > 1 ? (
              <div className="portal-student-picker">
                <label htmlFor="portal-student">Viewing student</label>
                <select
                  id="portal-student"
                  value={selectedStudent.id}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                >
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.displayName}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="portal-family-workspace">
              <StudentRail
                key={selectedStudent.id}
                student={selectedStudent}
                onChanged={loadProfile}
              />
              <div className="portal-workspace-main">
                <BandReadySection student={selectedStudent} />
                <ParticipationSection student={selectedStudent} onChanged={loadProfile} />
                <StudentResourcesSection student={selectedStudent} />
                <InstrumentRequestSection student={selectedStudent} />
                <UniformSection student={selectedStudent} />
                <BillingSection studentId={selectedStudent.id} studentName={selectedStudent.displayName} />
                <FamilyResources studentId={selectedStudent.id} />
              </div>
            </div>
          </>
        ) : profile ? (
          <div className="portal-empty-state">
            <h2>No student connected yet</h2>
            <p>Your sign-in works, but this family profile is not connected to a student record.</p>
            <Link className="portal-action-link" href="/portal/request">Request access</Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function BandReadySection({ student }) {
  return (
    <section className="portal-workspace-section portal-band-ready-callout" aria-labelledby="portal-band-ready-heading">
      <div>
        <p className="eyebrow">Open House</p>
        <h2 id="portal-band-ready-heading">Get {student.displayName} Band Ready</h2>
        <p>Complete the student&apos;s calendar, Day One supplies, forms, band expectations, clothing, Booster volunteer check-in, and Mr. Parker greeting in one saved path.</p>
      </div>
      <Link className="portal-action-link" href={`/portal/band-ready?studentId=${encodeURIComponent(student.id)}`}>Open Band Ready</Link>
    </section>
  );
}

function FamilyResources({ studentId }) {
  return (
    <nav className="portal-family-resources" aria-label="Family resources">
      <strong>Family resources</strong>
      <Link href={`/portal/band-ready?studentId=${encodeURIComponent(studentId)}`}>Band Ready checklist</Link>
      <Link href={`/portal/clothing?studentId=${encodeURIComponent(studentId)}`}>Open House clothing order</Link>
      <Link href="/portal/sponsorship">Business sponsorship</Link>
      <Link href="/info/marching-band-2026">Marching Band information</Link>
      <Link href="/calendar">Band calendar</Link>
      <Link href="/info/the-band-folder">The Band Folder</Link>
      <Link href="/assistant">Ask the Band Assistant</Link>
    </nav>
  );
}

function StudentResourcesSection({ student }) {
  const resources = student.resources;
  const percussion = /percussion|front ensemble|drum/i.test(`${student.instrument2026} ${student.ensemble2026}`);

  return (
    <section className="portal-workspace-section" aria-labelledby="student-resources-heading">
      <div className="portal-section-heading">
        <PortalSectionIcon type="resources" />
        <div className="portal-section-heading-copy">
          <h2 id="student-resources-heading">Classroom assignments</h2>
          <p>Use these provisional numbers when collecting equipment. Mr. Parker will confirm the physical items before they are issued.</p>
        </div>
      </div>
      {resources ? (
        <div className="portal-resource-grid">
          <article>
            <span>Instrument locker</span>
            <strong>{resources.lockerNumber || "Pending"}</strong>
            <small>{resources.lockerNumber ? "Physical locker location" : "Instrument must be confirmed first"}</small>
          </article>
          <article>
            <span>Lock</span>
            <strong>{resources.lockId ? `#${resources.lockId}` : "Pending"}</strong>
            <small>{resources.lockCombination ? `Combination ${resources.lockCombination}` : "Matched lock not assigned yet"}</small>
          </article>
          <article>
            <span>Tuner and clip</span>
            <strong>{resources.tunerNumber ? `#${resources.tunerNumber}` : "Not assigned"}</strong>
            <small>{resources.tunerSharedWith ? `Shared with ${resources.tunerSharedWith}` : resources.tunerNumber ? "Individual provisional assignment" : "No tuner assignment"}</small>
          </article>
        </div>
      ) : (
        <p className="portal-muted-status">
          {percussion ? "Percussion students use percussion storage and do not receive a regular instrument locker or tuner." : "Classroom assignments are still pending."}
        </p>
      )}
    </section>
  );
}

function BillingSection({ studentId, studentName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/billing/me");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not load fees.");
        return;
      }
      setData(json);
    } catch {
      setError("Could not load fees.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/me")
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setError(j.error || "Could not load fees.");
          return;
        }
        setData(j);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load fees.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const student = (data?.students || []).find((item) => item.id === studentId);
  const hasActivity = Boolean(
    student && (student.charges.length || student.payments.length || student.springTripRefund)
  );

  return (
    <section className="portal-workspace-section" aria-labelledby="portal-funding-heading">
      <div className="portal-section-heading">
        <PortalSectionIcon type="funding" />
        <div className="portal-section-heading-copy">
          <h2 id="portal-funding-heading">Funding and payments</h2>
          <p>Fees, fundraising credit, and payment history for {studentName}.</p>
        </div>
      </div>
      {error ? <p className="portal-field-error">{error}</p> : null}
      {!data && !error ? <p className="portal-muted-status">Loading financial record…</p> : null}
      {data && !hasActivity ? (
        <p className="portal-muted-status">No fees, payments, or funding activity is listed.</p>
      ) : null}
      {hasActivity ? (
        <StudentFeeCard
          student={student}
          paymentsEnabled={data.paymentsEnabled}
          onPaid={load}
        />
      ) : null}
    </section>
  );
}

function StudentFeeCard({ student, paymentsEnabled, onPaid }) {
  const balanceCents = Number(student.balanceCents) || 0;
  const owes = balanceCents > 0;
  const activeCharges = (student.charges || []).filter((c) => c.status === "active");
  const allPayments = student.payments || [];
  const kindTotals = (kind) => {
    const charges = activeCharges.filter((c) => (c.kind || "fee") === kind);
    const charged = charges.reduce((s, c) => s + (Number(c.amountCents) || 0), 0);
    const pays = allPayments.filter((p) => (p.kind || "fee") === kind);
    const paid = pays.reduce((s, p) => s + (Number(p.amountCents) || 0), 0);
    const sponsorship = pays
      .filter((p) => p.isSponsorship)
      .reduce((s, p) => s + (Number(p.amountCents) || 0), 0);
    return { charges, charged, paid, sponsorship, remaining: Math.max(charged - paid, 0) };
  };
  const goal = kindTotals("funding_goal");
  const fee = kindTotals("fee");
  const hasGoal = goal.charges.length > 0 || goal.paid > 0;
  const hasFee = fee.charges.length > 0 || fee.paid > 0;
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const canPayOnline = owes && paymentsEnabled && Boolean(clientId);

  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const amountRef = useRef(amount);
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  // Spring-Trip forgo offer (only present when the feature flag is live server-side).
  const refund = student.springTripRefund || null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [forgoBusy, setForgoBusy] = useState(false);
  const [forgoError, setForgoError] = useState("");

  async function submitRefundChoice(choice) {
    setForgoBusy(true);
    setForgoError("");
    try {
      const res = await fetch("/api/billing/forgo-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, choice })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgoError(json.error || "Could not save your choice. Please try again.");
        return;
      }
      setConfirmOpen(false);
      if (onPaid) onPaid(); // re-fetch /api/billing/me so the goal + end state refresh
    } catch {
      setForgoError("Could not save your choice. Please try again.");
    } finally {
      setForgoBusy(false);
    }
  }

  return (
    <article className="portal-finance-record">
      <div className="portal-finance-summary">
        <strong>Current summary</strong>
        <span className="portal-status-pill">
          {fee.remaining > 0
            ? `Balance ${formatUsd(fee.remaining)}`
            : goal.remaining > 0
              ? `${formatUsd(goal.remaining)} to raise`
              : "All set"}
        </span>
      </div>

      {hasGoal ? (
        <div className="portal-field">
          <span className="portal-field-label">Marching Band season funding</span>
          <span className="portal-field-value">
            Goal {formatUsd(goal.charged)} · Raised {formatUsd(goal.paid)} · Remaining{" "}
            {formatUsd(goal.remaining)}
            {goal.sponsorship > 0 ? ` (includes ${formatUsd(goal.sponsorship)} from sponsorships)` : ""}
          </span>
          <span className="portal-field-note">
            This is the 2026 Marching Band goal, not a bill. Sponsorships and fundraising count toward it.
          </span>
        </div>
      ) : null}

      {hasFee ? (
        <div className="portal-field">
          <span className="portal-field-label">Fees</span>
          <ul className="portal-fee-list">
            {fee.charges.map((c) => (
              <li key={c.id}>
                {c.label} — {formatUsd(c.amountCents)}
              </li>
            ))}
          </ul>
          <span className="portal-field-value">
            Charged {formatUsd(fee.charged)} · Paid {formatUsd(fee.paid)} · Balance {formatUsd(fee.remaining)}
          </span>
        </div>
      ) : null}

      {student.payments.length ? (
        <div className="portal-field">
          <span className="portal-field-label">Payments</span>
          <ul className="portal-fee-list">
            {student.payments.map((p) => (
              <li key={p.id}>
                {new Date(p.receivedAt).toLocaleDateString()} — {formatUsd(p.amountCents)}{" "}
                ({p.isSponsorship ? `sponsorship${p.payerName ? ` — ${p.payerName}` : ""}` : p.method})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refund ? (
        <div className="portal-field portal-refund-field">
          <span className="portal-field-label">Spring Trip 2026 refund</span>

          {refund.status === "applied_mb" ? (
            <>
              <span className="portal-field-value">
                ✓ Applied. {formatUsd(refund.confirmedCents)} is now counting toward {student.name}&rsquo;s
                marching band funding goal.
              </span>
              {refund.topupCents > 0 ? (
                <span className="portal-field-note">
                  If the final refund from the bus company clears, the remaining{" "}
                  {formatUsd(refund.topupCents)} will be applied too, for {formatUsd(refund.fullCents)} total.
                  You will not receive a check for this amount.
                </span>
              ) : null}
            </>
          ) : refund.status === "check" ? (
            <span className="portal-field-value">
              You chose to have your Spring Trip refund sent back as a check. Nothing was applied to the
              funding goal.
            </span>
          ) : (
            <>
              <span className="portal-field-value">
                The May trip was cancelled and your family is owed a refund. You can have it sent back as a
                check, or apply it toward {student.name}&rsquo;s marching band season instead.
              </span>
              <span className="portal-field-note">
                Right now we can confirm {formatUsd(refund.confirmedCents)}.
                {refund.topupCents > 0
                  ? ` If the final refund from the bus company clears, it rises to ${formatUsd(refund.fullCents)}.`
                  : ""}{" "}
                Applying it means you forgo the refund check and we credit that amount to your season funding
                goal.
              </span>
              <button
                type="button"
                className="portal-primary-action"
                onClick={() => {
                  setForgoError("");
                  setConfirmOpen(true);
                }}
              >
                Apply my refund to marching band
              </button>
              {forgoError ? (
                <span className="portal-field-note portal-error-text">
                  {forgoError}
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {canPayOnline ? (
        showPay ? (
          <div className="portal-field-edit portal-pay-form">
            <label className="portal-field-label" htmlFor={`pay-${student.id}`}>
              Amount to pay (you can pay any amount toward the balance)
            </label>
            <input
              id={`pay-${student.id}`}
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <PayPalButton
              clientId={clientId}
              studentId={student.id}
              amountRef={amountRef}
              onPaid={() => {
                setShowPay(false);
                if (onPaid) onPaid();
              }}
            />
          </div>
        ) : (
          <button type="button" className="portal-primary-action" onClick={() => setShowPay(true)}>
            Pay online
          </button>
        )
      ) : owes && !paymentsEnabled ? (
        <p className="portal-field-note">Online payment is coming soon. You can still pay by check.</p>
      ) : null}

      {confirmOpen && refund ? (
        <div
          className="portal-modal-backdrop"
          onClick={() => (forgoBusy ? null : setConfirmOpen(false))}
        >
          <div
            className="portal-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-refund-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="portal-refund-title">Apply your Spring Trip refund?</h3>
            <p className="portal-modal-copy">
              You are choosing to <strong>forgo your refund check</strong>. The boosters keep that amount and
              credit <strong>{formatUsd(refund.confirmedCents)}</strong> toward {student.name}&rsquo;s marching
              band funding goal
              {refund.topupCents > 0 ? ` (up to ${formatUsd(refund.fullCents)} if the final bus-company refund clears)` : ""}.
              This cannot be sent back to you as cash once applied.
            </p>
            {forgoError ? (
              <p className="portal-modal-error">{forgoError}</p>
            ) : null}
            <div className="portal-modal-actions">
              <button
                type="button"
                className="portal-link-btn"
                disabled={forgoBusy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={forgoBusy}
                className="portal-primary-action"
                onClick={() => submitRefundChoice("forgo")}
              >
                {forgoBusy ? "Applying…" : `Yes, apply ${formatUsd(refund.confirmedCents)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function PayPalButton({ clientId, studentId, amountRef, onPaid }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    let buttons;
    loadPaypalSdk(clientId)
      .then((paypal) => {
        if (cancelled || !containerRef.current) return;
        buttons = paypal.Buttons({
          createOrder: async () => {
            setStatus("");
            const amountCents = Math.round(Number(amountRef.current) * 100);
            const res = await fetch("/api/billing/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ studentId, amountCents })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Could not start payment.");
            return json.orderId;
          },
          onApprove: async (data) => {
            const res = await fetch("/api/billing/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              setStatus("There was a problem completing your payment.");
              return;
            }
            setStatus("Payment received — thank you!");
            if (onPaid) onPaid();
          },
          onError: () => setStatus("Payment could not be processed. Please try again.")
        });
        buttons.render(containerRef.current);
      })
      .catch(() => setStatus("Could not load PayPal."));
    return () => {
      cancelled = true;
      if (buttons && buttons.close) buttons.close();
    };
  }, [clientId, studentId, amountRef, onPaid]);

  return (
    <div>
      <div ref={containerRef} />
      {status ? <span className="portal-field-pending">{status}</span> : null}
    </div>
  );
}

// Band Shoppe's own size guides, linked (not mirrored) on purpose: these are the
// charts the vendor fills the order against, so a local copy could silently go
// stale against a sizing revision and a family would measure to an outdated
// chart. A dead link fails loudly; a stale chart fails quietly. Sizes are called
// out because the band guide is ~10MB on a phone.
const SIZE_GUIDES = [
  {
    label: "Band — Classic Top / Full Length",
    note: "PDF, 10 MB",
    href: "https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Classic_Top_Full_Length.pdf?v=1722619657"
  },
  {
    label: "Guard — Unitard",
    note: "PDF, 1.6 MB",
    href: "https://cdn.shopify.com/s/files/1/0333/9540/9031/files/Size_Guide_-_Unitard_Unisex.pdf?v=1722619651"
  }
];

// Same grouping as the staff form (app/admin/measurements/page.jsx): by what the
// hands are doing, so a family measuring at home wraps the tape for one group,
// runs it along for the next, then puts it down. Girth, weight, and back length
// removed 2026-07-16 (Rob) -- no Band Shoppe guide asks for them. Columns stay in
// the table.
const MEASUREMENT_GROUPS = [
  {
    title: "Student",
    fields: [
      { key: "gender", label: "Gender", type: "text" },
      { key: "height", label: "Height", type: "text", placeholder: "e.g. 5-9" }
    ]
  },
  {
    title: "Around (wrap the tape)",
    fields: [
      {
        key: "neckIn",
        label: "Neck (in)",
        type: "number",
        hint: "Around the base of the neck"
      },
      {
        key: "chestIn",
        label: "Chest (in)",
        type: "number",
        hint: "Arms at sides, around the fullest part of the chest, tape parallel to the floor"
      },
      {
        key: "waistIn",
        label: "Waist (in)",
        type: "number",
        hint: "Around the narrowest part of the natural waist, at the navel"
      },
      {
        key: "hipsIn",
        label: "Hips (in)",
        type: "number",
        hint: "Heels together, around the fullest part of the hips"
      }
    ]
  },
  {
    title: "Length (run the tape)",
    fields: [
      {
        key: "armLengthIn",
        label: "Arm Length (in)",
        type: "number",
        hint: "Shoulder to wrist"
      },
      {
        key: "inseamIn",
        label: "Inseam (in)",
        type: "number",
        hint: "Inside of the leg, crotch to the bottom of the ankle bone"
      }
    ]
  },
  {
    title: "Sizes (no tape)",
    fields: [
      {
        key: "shoeSize",
        label: "Shoe Size",
        type: "text",
        placeholder: "e.g. 10.5 M",
        hint: "Include the scale, e.g. 10.5 M or 8 W"
      },
      {
        key: "gloveSize",
        label: "Glove Size",
        type: "text",
        placeholder: "S / M / L / XL"
      },
      {
        key: "shirtSize",
        label: "T-Shirt Size",
        type: "text",
        placeholder: "S / M / L / XL / 2XL"
      }
    ]
  }
];

const MEASUREMENT_FIELDS = MEASUREMENT_GROUPS.flatMap((g) => g.fields);

const EMPTY_MEASUREMENTS = MEASUREMENT_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: "" }), { notes: "" });

function measurementsFromRow(row) {
  if (!row) return { ...EMPTY_MEASUREMENTS };
  return {
    gender: row.gender || "",
    height: row.height || "",
    chestIn: row.chest_in ?? "",
    waistIn: row.waist_in ?? "",
    hipsIn: row.hips_in ?? "",
    inseamIn: row.inseam_in ?? "",
    neckIn: row.neck_in ?? "",
    armLengthIn: row.arm_length_in ?? "",
    shoeSize: row.shoe_size || "",
    gloveSize: row.glove_size || "",
    shirtSize: row.shirt_size || "",
    notes: row.notes || ""
  };
}

function MeasurementsPanel({ studentId }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_MEASUREMENTS);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setError("");
      const res = await fetch(`/api/portal/measurements?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Could not load measurements.");
        setStatus("ready");
        return;
      }
      setForm(measurementsFromRow(data.measurement));
      setUpdatedAt(data.measurement?.updated_at || null);
      setStatus("ready");
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    setStatus("saving");
    setError("");
    const res = await fetch("/api/portal/measurements", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...form })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("ready");
      setError(data.error || "Could not save measurements.");
      return;
    }
    setUpdatedAt(new Date().toISOString());
    setStatus("saved");
  }

  const formattedUpdated = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className="portal-measurements">
      <h3>Uniform Measurements</h3>
      <p className="portal-consent-note">
        Measuring at home? Enter your uniform measurements below and we&apos;ll use them for fitting.
      </p>
      <p className="portal-size-guides">
        <strong>Size guides:</strong>{" "}
        {SIZE_GUIDES.map((g, i) => (
          <span key={g.href}>
            {i > 0 ? " · " : ""}
            <a href={g.href} target="_blank" rel="noopener noreferrer">
              {g.label}
            </a>{" "}
            <span className="portal-field-note">({g.note})</span>
          </span>
        ))}
      </p>
      {status === "loading" ? <p className="portal-field-pending">Loading measurements...</p> : null}
      {formattedUpdated ? <p className="portal-field-note">Last updated {formattedUpdated}</p> : null}

      {MEASUREMENT_GROUPS.map((group) => (
        <fieldset className="portal-measurement-group" key={group.title}>
          <legend>{group.title}</legend>
          <div className="portal-measurement-grid">
            {group.fields.map((f) => (
              <div className="portal-field" key={f.key}>
                <span className="portal-field-label">{f.label}</span>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  step={f.type === "number" ? "0.5" : undefined}
                  value={form[f.key]}
                  placeholder={f.placeholder || ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
                {f.hint ? <span className="portal-field-note">{f.hint}</span> : null}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="portal-measurement-grid">
        <div className="portal-field">
          <span className="portal-field-label">Notes</span>
          <textarea
            value={form.notes}
            placeholder="Anything else that helps with fitting"
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
      </div>

      <div className="portal-field-edit">
        <button type="button" onClick={save} disabled={status === "saving" || status === "loading"}>
          {status === "saving" ? "Saving..." : "Save measurements"}
        </button>
      </div>
      {status === "saved" ? <span className="portal-field-pending">Saved. Thanks!</span> : null}
      {error ? <span className="portal-field-error">{error}</span> : null}
    </div>
  );
}

function StudentRail({ student, onChanged }) {
  const guardians = [...(student.guardians || [])].sort((a, b) => Number(b.primary) - Number(a.primary));
  const guardianCount = guardians.length;

  return (
    <aside className="portal-profile-rail" aria-label={`${student.displayName} profile information`}>
      <div className="portal-student-identity">
        <span className="portal-student-avatar" aria-hidden="true">{initials(student.displayName)}</span>
        <h2>{student.displayName}</h2>
        <p>{student.grade || "Grade not listed"}</p>
      </div>

      <section className="portal-rail-group" aria-labelledby="portal-demographics-heading">
        <h3 id="portal-demographics-heading" className="portal-rail-heading"><PortalSectionIcon type="person" />Demographics</h3>
        <StudentDemographics
          key={`${student.id}-${student.preferredFirst}-${student.schoolEmail}-${student.cellPhone}`}
          student={student}
          onSaved={onChanged}
        />
      </section>

      <section className="portal-rail-group" aria-labelledby="portal-notes-heading">
        <h3 id="portal-notes-heading">Notes on file</h3>
        <EditableField
          key={`notes-${student.id}`}
          field="student_notes"
          studentId={student.id}
          label="Family notes"
          value={student.note || ""}
          placeholder="Add information Mr. Parker should know"
          multiline
          allowEmpty
        />
      </section>

      <section className="portal-rail-group portal-guardians" aria-labelledby="portal-family-heading">
        <h3 id="portal-family-heading">Family contacts</h3>
        {guardianCount ? (
          <div className="portal-guardian-list">
            {guardians.map((g) => (
              <article className="portal-guardian" key={g.id}>
                <p className="portal-guardian-name">
                  {g.name}
                  {g.primary ? <span className="portal-tag">Primary</span> : null}
                  {g.isSelf ? <span className="portal-tag">You</span> : null}
                </p>
                {g.role ? <p className="portal-guardian-role">{g.role}</p> : null}
                {g.phones?.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {g.emails?.map((e) => (
                  <p key={e}>{e}</p>
                ))}
                <GuardianEdit guardian={g} studentId={student.id} studentName={student.displayName} onSaved={onChanged} />
              </article>
            ))}
          </div>
        ) : null}

        {guardianCount === 0 ? (
          <p className="portal-prompt portal-prompt-strong">
            No guardian is on file for {student.displayName}. Please add at least one adult.
          </p>
        ) : guardianCount === 1 ? (
          <p className="portal-prompt">A second guardian is recommended. Add one if there is another adult to reach.</p>
        ) : null}

        <GuardianAdd studentId={student.id} studentName={student.displayName} onAdded={onChanged} />
      </section>

      <p className="portal-privacy-note">
        Changes take effect immediately. To remove a person from the family record entirely, contact Mr. Parker. <Link href="/privacy">Privacy Notice</Link>
      </p>
    </aside>
  );
}

function inferredBandPeriod(student) {
  if (student.bandPeriod2026) return student.bandPeriod2026;
  if (student.ensemble2026 === "Concert Band") return "1st Period";
  if (student.ensemble2026 === "Percussion Ensemble") return "2nd Period";
  if (student.ensemble2026 === "Wind Ensemble") return "4th Period";
  return "Not enrolled in an AHS band period";
}

function inferredMarchingRole(student) {
  if (student.marchingRoleCategory2026) return student.marchingRoleCategory2026;
  const legacy = String(student.marchingRole2026 || "").toLowerCase();
  if (legacy.includes("drum major")) return "Drum Major";
  if (legacy.includes("guard")) return "Color Guard Member";
  if (legacy.includes("percussion")) {
    const assignment = String(student.instrument2026 || "").toLowerCase();
    return /(snare|quad|tenor|bass drum|cymbal)/.test(assignment) ? "Drumline Member" : "Front Ensemble Member";
  }
  if (legacy) return "Wind Player";
  return "";
}

function inferredMarchingAssignment(student) {
  if (student.marchingAssignment2026) return student.marchingAssignment2026;
  const role = inferredMarchingRole(student);
  if (role === "Drum Major") return "Drum Major / Conductor";
  if (["Wind Player", "Drumline Member", "Front Ensemble Member"].includes(role)) return student.instrument2026 || student.marchingRole2026 || "";
  return "";
}

function ParticipationSection({ student, onChanged }) {
  const [editing, setEditing] = useState(false);
  const current = {
    bandPeriod: inferredBandPeriod(student),
    ensemble: student.ensemble2026 || "Not currently assigned",
    concertInstrument: student.instrument2026 || "",
    marchingEnrollment: String(student.marching2026 || "").toLowerCase() === "yes" ? "Yes" : "No",
    marchingRole: inferredMarchingRole(student),
    marchingAssignment: inferredMarchingAssignment(student)
  };
  return (
    <section className="portal-workspace-section" aria-labelledby="portal-participation-heading">
      <div className="portal-section-heading">
        <div>
          <h2 id="portal-participation-heading">Band participation</h2>
          <p>{student.displayName}&apos;s current 2026–27 program record.</p>
        </div>
        {!student.participationRequest ? (
          <button type="button" className="portal-text-action" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel" : "Request a change"}
          </button>
        ) : null}
      </div>
      <dl className="portal-program-grid">
        <div><dt>Band period</dt><dd>{programValue(current.bandPeriod)}</dd></div>
        <div><dt>Concert ensemble</dt><dd>{programValue(current.ensemble)}</dd></div>
        <div><dt>Concert band instrument</dt><dd>{programValue(current.concertInstrument)}</dd></div>
        <div><dt>Enrolled in Marching Band</dt><dd>{current.marchingEnrollment}</dd></div>
        {current.marchingEnrollment === "Yes" ? <div><dt>Marching role</dt><dd>{programValue(current.marchingRole)}</dd></div> : null}
        {current.marchingEnrollment === "Yes" ? <div><dt>Marching assignment</dt><dd>{programValue(current.marchingAssignment)}</dd></div> : null}
      </dl>
      {student.participationRequest ? (
        <PendingParticipationRequest request={student.participationRequest} student={student} onChanged={onChanged} />
      ) : null}
      {editing ? (
        <ParticipationRequestForm student={student} initial={current} onCancel={() => setEditing(false)} onSubmitted={async () => { setEditing(false); if (onChanged) await onChanged(); }} />
      ) : null}
    </section>
  );
}

function SelectField({ label, value, options, onChange, required = true }) {
  return (
    <label className="portal-field">
      <span className="portal-field-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        {!value ? <option value="">Choose one</option> : null}
        {optionsWithCurrent(options, value).map((option) => <option value={option} key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ParticipationRequestForm({ student, initial, onCancel, onSubmitted }) {
  const [form, setForm] = useState(initial);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const assignmentOptions = MARCHING_ASSIGNMENTS[form.marchingRole] || [];

  function setField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "marchingEnrollment" && value === "No") {
        next.marchingRole = "";
        next.marchingAssignment = "";
      }
      if (field === "marchingRole") next.marchingAssignment = "";
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    const response = await fetch("/api/portal/participation-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, ...form, note })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("idle");
      setError(data.error || "Could not submit the request.");
      return;
    }
    setStatus("saved");
    await onSubmitted();
  }

  return (
    <form className="portal-participation-form" onSubmit={submit}>
      <p className="portal-muted-status">Choose the record you believe is correct. Nothing changes until Mr. Parker reviews it.</p>
      <div className="portal-participation-fields">
        <SelectField label="Band period" value={form.bandPeriod} options={BAND_PERIOD_OPTIONS} onChange={(value) => setField("bandPeriod", value)} />
        <SelectField label="Concert ensemble" value={form.ensemble} options={ENSEMBLE_OPTIONS} onChange={(value) => setField("ensemble", value)} />
        <SelectField label="Concert band instrument" value={form.concertInstrument} options={CONCERT_INSTRUMENT_OPTIONS} onChange={(value) => setField("concertInstrument", value)} />
        <SelectField label="Enrolled in Marching Band" value={form.marchingEnrollment} options={MARCHING_ENROLLMENT_OPTIONS} onChange={(value) => setField("marchingEnrollment", value)} />
        {form.marchingEnrollment === "Yes" ? <SelectField label="Marching role" value={form.marchingRole} options={MARCHING_ROLE_OPTIONS} onChange={(value) => setField("marchingRole", value)} /> : null}
        {form.marchingEnrollment === "Yes" ? <SelectField label="Marching assignment" value={form.marchingAssignment} options={assignmentOptions} onChange={(value) => setField("marchingAssignment", value)} /> : null}
      </div>
      <label className="portal-field">
        <span className="portal-field-label">Anything Mr. Parker should know? (optional)</span>
        <textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="portal-field-edit">
        <button type="submit" disabled={status === "saving"}>{status === "saving" ? "Submitting..." : "Send for approval"}</button>
        <button type="button" className="portal-link-btn" onClick={onCancel}>Cancel</button>
      </div>
      {error ? <span className="portal-field-error">{error}</span> : null}
    </form>
  );
}

function PendingParticipationRequest({ request, student, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function withdraw() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/portal/participation-request", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setError(data.error || "Could not withdraw the request.");
      return;
    }
    if (onChanged) await onChanged();
  }
  return (
    <div className="portal-pending-request">
      <strong>Participation change awaiting Mr. Parker&apos;s approval</strong>
      <p>The official record above has not changed.</p>
      <dl className="portal-pending-values">
        <div><dt>Band period</dt><dd>{request.requested?.bandPeriod || "Not listed"}</dd></div>
        <div><dt>Concert ensemble</dt><dd>{request.requested?.ensemble || "Not listed"}</dd></div>
        <div><dt>Concert instrument</dt><dd>{request.requested?.concertInstrument || "Not listed"}</dd></div>
        <div><dt>Marching Band</dt><dd>{request.requested?.marchingEnrollment || "Not listed"}</dd></div>
        {request.requested?.marchingEnrollment === "Yes" ? <div><dt>Marching role</dt><dd>{request.requested?.marchingRole || "Not listed"}</dd></div> : null}
        {request.requested?.marchingEnrollment === "Yes" ? <div><dt>Marching assignment</dt><dd>{request.requested?.marchingAssignment || "Not listed"}</dd></div> : null}
      </dl>
      <button type="button" className="portal-link-btn" disabled={busy} onClick={withdraw}>{busy ? "Withdrawing..." : `Withdraw ${student.displayName}'s request`}</button>
      {error ? <span className="portal-field-error">{error}</span> : null}
    </div>
  );
}

function UniformSection({ student }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="portal-workspace-section" aria-labelledby="portal-uniform-heading">
      <div className="portal-section-heading">
        <PortalSectionIcon type="shirt" />
        <div className="portal-section-heading-copy">
          <h2 id="portal-uniform-heading">Uniform readiness</h2>
          <p>Review or enter the measurements used for uniform fitting.</p>
        </div>
        <button
          type="button"
          className="portal-secondary-action"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Close measurements" : "Open measurements"}
        </button>
      </div>
      {open ? <MeasurementsPanel studentId={student.id} /> : (
        <p className="portal-muted-status">The full measurement form stays closed until you need it.</p>
      )}
    </section>
  );
}

function StudentDemographics({ student, onSaved }) {
  const original = {
    student_preferred_first: student.preferredFirst || "",
    student_school_email: student.schoolEmail || "",
    student_cell_phone: student.cellPhone || ""
  };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(original);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const changed = Object.entries(form).filter(([field, value]) => value.trim() !== original[field]);
    if (!changed.length) {
      setOpen(false);
      setStatus("idle");
      return;
    }
    const responses = await Promise.all(changed.map(([field, value]) => fetch("/api/portal/update-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, studentId: student.id, value })
    })));
    const failed = responses.find((response) => !response.ok);
    if (failed) {
      const data = await failed.json().catch(() => ({}));
      setStatus("idle");
      setMessage(data.error || "Could not save all student details.");
      if (onSaved) await onSaved();
      return;
    }
    setStatus("saved");
    setOpen(false);
    if (onSaved) await onSaved();
  }

  if (open) {
    return (
      <form className="portal-guardian-form portal-demographics-form" onSubmit={submit}>
        <label>
          <span className="portal-field-label">Preferred name</span>
          <input value={form.student_preferred_first} placeholder="Preferred name, if any" onChange={(event) => setForm({ ...form, student_preferred_first: event.target.value })} />
        </label>
        <label>
          <span className="portal-field-label">Student email</span>
          <input type="email" value={form.student_school_email} onChange={(event) => setForm({ ...form, student_school_email: event.target.value })} required />
        </label>
        <label>
          <span className="portal-field-label">Student phone</span>
          <input type="tel" value={form.student_cell_phone} placeholder="Phone, if available" onChange={(event) => setForm({ ...form, student_cell_phone: event.target.value })} />
        </label>
        <div className="portal-field-edit">
          <button type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving..." : "Save student details"}</button>
          <button type="button" className="portal-link-btn" onClick={() => { setForm(original); setOpen(false); setMessage(""); }}>Cancel</button>
        </div>
        {message ? <span className="portal-field-error">{message}</span> : null}
      </form>
    );
  }

  return (
    <div className="portal-guardian-list portal-demographics-summary">
      <article className="portal-guardian">
        <p className="portal-guardian-name">
          {student.preferredFirst || <em>No preferred name listed</em>}
          <span className="portal-tag">{student.grade || "Grade not listed"}</span>
          <span className="portal-tag">{statusValue(student.status)}</span>
        </p>
        <p>{student.schoolEmail || <em>No student email listed</em>}</p>
        <p>{student.cellPhone || <em>No student phone listed</em>}</p>
        <button type="button" className="portal-link-btn portal-guardian-edit" onClick={() => setOpen(true)}>Edit student details</button>
        {status === "saved" ? <span className="portal-field-pending">{SAVED_NOTE}</span> : null}
      </article>
    </div>
  );
}

function EditableField({ field, studentId, label, value, placeholder, note, featured = false, multiline = false, allowEmpty = false, inputType = "text" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [current, setCurrent] = useState(value);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function save() {
    setStatus("saving");
    setError("");
    const res = await fetch("/api/portal/update-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, studentId, value: draft })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("idle");
      setError(data.error || "Could not save.");
      return;
    }
    setCurrent(draft);
    setEditing(false);
    setStatus("saved");
  }

  return (
    <div className={`portal-field ${featured ? "portal-field-featured" : ""}`}>
      <span className="portal-field-label">{label}</span>
      {note ? <span className="portal-field-note">{note}</span> : null}
      {editing ? (
        <div className="portal-field-edit">
          {multiline ? (
            <textarea rows="5" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
          ) : (
            <input type={inputType} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
          )}
          <button type="button" onClick={save} disabled={status === "saving" || (!allowEmpty && !draft.trim())}>
            {status === "saving" ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="portal-link-btn"
            onClick={() => {
              setDraft(current);
              setEditing(false);
              setError("");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="portal-field-show">
          <span className="portal-field-value">{current || <em>{placeholder || "Not set"}</em>}</span>
          <button type="button" className="portal-link-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
      {status === "saved" ? <span className="portal-field-pending">{SAVED_NOTE}</span> : null}
      {error ? <span className="portal-field-error">{error}</span> : null}
    </div>
  );
}

function GuardianEdit({ guardian, studentId, studentName, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: guardian.name || "",
    relationship: guardian.role || "",
    phone: guardian.phones?.[0] || "",
    email: guardian.emails?.[0] || ""
  });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    const res = await fetch("/api/portal/guardian-request", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, guardianId: guardian.id, ...form })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("idle");
      setMessage(data.error || "Could not update this guardian.");
      return;
    }
    setStatus("saved");
    setMessage("Family contact updated.");
    setOpen(false);
    if (onSaved) await onSaved();
  }

  if (!open) {
    return <button type="button" className="portal-link-btn portal-guardian-edit" onClick={() => setOpen(true)}>Edit contact</button>;
  }

  return (
    <form className="portal-guardian-form" onSubmit={submit}>
      <p className="portal-field-label">Edit {guardian.name} for {studentName}</p>
      <input aria-label="Guardian name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input aria-label="Relationship" placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
      <input aria-label="Guardian phone" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input aria-label="Guardian email" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <div className="portal-field-edit">
        <button type="submit" disabled={status === "saving" || !form.name.trim() || (!form.phone.trim() && !form.email.trim())}>{status === "saving" ? "Saving..." : "Save contact"}</button>
        <button type="button" className="portal-link-btn" onClick={() => { setOpen(false); setMessage(""); }}>Cancel</button>
      </div>
      {message ? <span className={status === "saved" ? "portal-field-pending" : "portal-field-error"}>{message}</span> : null}
    </form>
  );
}

function GuardianAdd({ studentId, studentName, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "", email: "" });
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/portal/guardian-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...form })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("idle");
      setMessage(data.error || "Could not add this guardian.");
      return;
    }
    setStatus("done");
    setMessage(
      form.email
        ? "Added to this student's family record. They can use this email to sign in."
        : "Added to this student's family record."
    );
    setForm({ name: "", relationship: "", phone: "", email: "" });
    if (onAdded) onAdded();
  }

  if (!open) {
    return (
      <button type="button" className="portal-link-btn" onClick={() => setOpen(true)}>
        + Add a guardian
      </button>
    );
  }

  return (
    <form className="portal-guardian-form" onSubmit={submit}>
      <p className="portal-field-label">Add a guardian for {studentName}</p>
      <input
        placeholder="Full name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        placeholder="Relationship (mom, grandfather, etc.)"
        value={form.relationship}
        onChange={(e) => setForm({ ...form, relationship: e.target.value })}
      />
      <input
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <input
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <div className="portal-field-edit">
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Adding..." : "Add guardian"}
        </button>
        <p className="portal-consent-note">
          By adding this person, you confirm the information is yours to share. See our{" "}
          <Link href="/privacy">Privacy Notice</Link>.
        </p>
        <button type="button" className="portal-link-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {message ? <span className={status === "done" ? "portal-field-pending" : "portal-field-error"}>{message}</span> : null}
    </form>
  );
}
