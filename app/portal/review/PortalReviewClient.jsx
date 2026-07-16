"use client";

import { useEffect, useRef, useState } from "react";

const PENDING_NOTE = "Saved. Showing now; Mr. Parker reviews before it updates the official record.";

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

  async function loadProfile() {
    const res = await fetch("/api/portal/me");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState({ status: "error", message: data.error || "Profile access expired. Go to the sign-in page and request a new code." });
      return;
    }
    setProfile(data);
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
    if (!cancelled) loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const ownPhone = profile?.contacts?.phones?.[0]?.value || "";

  return (
    <main className="portal-shell">
      <section className="portal-panel portal-panel-wide">
        <p className="eyebrow">Ashley Bands</p>
        <h1>My Profile</h1>
        <p className="portal-consent-note">
          Review and update your family&apos;s details anytime. Changes take effect immediately.
          To remove something entirely, ask and it&apos;s deleted right away.{" "}
          <a href="/privacy">Privacy Notice</a>
        </p>
        {state.status !== "ready" ? (
          <p className={`portal-message ${state.status === "error" ? "error" : ""}`}>{state.message}</p>
        ) : null}

        {profile ? (
          <div className="portal-profile">
            <p className="portal-signed-in">
              Signed in as <strong>{profile.person?.display_name || profile.email}</strong>
              <span className="portal-signed-email">{profile.email}</span>
            </p>

            <section className="portal-section">
              <h2>Quick Links</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { href: "/info/marching-band-2026", label: "Marching Band" },
                  { href: "/info/the-band-folder", label: "Resources" },
                  { href: "/assistant", label: "Ask the Band Assistant" },
                  { href: "/staff-sprint", label: "Staff Sprint (note race)" }
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    style={{
                      padding: "6px 12px",
                      border: "1px solid #7b1829",
                      borderRadius: 16,
                      color: "#7b1829",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>

            <section className="portal-section">
              <h2>You</h2>
              <EditableField field="person_display_name" label="Your name" value={profile.person?.display_name || ""} />
              <EditableField field="person_phone" label="Your phone" value={ownPhone} placeholder="Add a phone number" />
              <div className="portal-field">
                <span className="portal-field-label">Your email</span>
                <span className="portal-field-value">{profile.email}</span>
                <span className="portal-field-note">Used to sign in. Contact Mr. Parker to change it.</span>
              </div>
            </section>

            {profile.students?.length ? (
              profile.students.map((student) => (
                <StudentCard key={student.id} student={student} onChanged={loadProfile} />
              ))
            ) : (
              <p className="portal-copy">No student is connected to this profile yet.</p>
            )}

            <BillingSection />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function BillingSection() {
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

  if (error) return null;
  if (!data) return null;
  const students = (data.students || []).filter(
    (s) => s.charges.length || s.payments.length || s.springTripRefund
  );
  if (!students.length) return null;

  return (
    <section className="portal-section">
      <h2>Fees &amp; Payments</h2>
      {students.map((s) => (
        <StudentFeeCard
          key={s.id}
          student={s}
          paymentsEnabled={data.paymentsEnabled}
          onPaid={load}
        />
      ))}
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
  const enrolledMB = (student.charges || []).some((c) => /marching band/i.test(c.label || ""));
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
    <article className="portal-student-card">
      <div className="portal-student-head">
        <h3>{student.name}</h3>
        <span className="portal-tag">
          {fee.remaining > 0
            ? `Balance ${formatUsd(fee.remaining)}`
            : goal.remaining > 0
              ? `${formatUsd(goal.remaining)} to raise`
              : "All set"}
        </span>
      </div>

      {enrolledMB ? (
        <div className="portal-field">
          <span className="portal-field-label">2026 sign-ups</span>
          <span className="portal-field-value">Marching Band 2026 ✓</span>
        </div>
      ) : null}

      {hasGoal ? (
        <div className="portal-field">
          <span className="portal-field-label">Season funding</span>
          <span className="portal-field-value">
            Goal {formatUsd(goal.charged)} · Raised {formatUsd(goal.paid)} · Remaining{" "}
            {formatUsd(goal.remaining)}
            {goal.sponsorship > 0 ? ` (includes ${formatUsd(goal.sponsorship)} from sponsorships)` : ""}
          </span>
          <span className="portal-field-note">
            This is our shared season goal, not a bill. Sponsorships and fundraising count toward it.
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
        <div className="portal-field" style={{ borderTop: "1px solid #eee", paddingTop: 14, marginTop: 6 }}>
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
                onClick={() => {
                  setForgoError("");
                  setConfirmOpen(true);
                }}
              >
                Apply my refund to marching band
              </button>
              {forgoError ? (
                <span className="portal-field-note" style={{ color: "#7b1829" }}>
                  {forgoError}
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {canPayOnline ? (
        showPay ? (
          <div className="portal-field-edit" style={{ flexDirection: "column", alignItems: "stretch" }}>
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
          <button type="button" onClick={() => setShowPay(true)}>
            Pay online
          </button>
        )
      ) : owes && !paymentsEnabled ? (
        <p className="portal-field-note">Online payment is coming soon. You can still pay by check.</p>
      ) : null}

      {confirmOpen && refund ? (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50
          }}
          onClick={() => (forgoBusy ? null : setConfirmOpen(false))}
        >
          <div
            style={{ background: "#fff", borderRadius: 10, padding: "22px", maxWidth: 440, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Apply your Spring Trip refund?</h3>
            <p style={{ color: "#333", lineHeight: 1.5 }}>
              You are choosing to <strong>forgo your refund check</strong>. The boosters keep that amount and
              credit <strong>{formatUsd(refund.confirmedCents)}</strong> toward {student.name}&rsquo;s marching
              band funding goal
              {refund.topupCents > 0 ? ` (up to ${formatUsd(refund.fullCents)} if the final bus-company refund clears)` : ""}.
              This cannot be sent back to you as cash once applied.
            </p>
            {forgoError ? (
              <p style={{ color: "#7b1829", fontWeight: 600 }}>{forgoError}</p>
            ) : null}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
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
                style={{
                  background: "#7b1829", color: "#fff", border: "none", borderRadius: 6,
                  padding: "10px 16px", fontWeight: 600, cursor: forgoBusy ? "default" : "pointer",
                  opacity: forgoBusy ? 0.7 : 1
                }}
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

const MEASUREMENT_FIELDS = [
  { key: "gender", label: "Gender", type: "text" },
  { key: "height", label: "Height", type: "text", placeholder: "e.g. 5-9" },
  { key: "weightLbs", label: "Weight (lbs)", type: "number" },
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
  },
  {
    key: "inseamIn",
    label: "Inseam (in)",
    type: "number",
    hint: "Inside of the leg, crotch to the bottom of the ankle bone"
  },
  {
    key: "backLengthIn",
    label: "Back Length (in)",
    type: "number",
    hint: "Base of the neck to the natural waistline"
  },
  {
    key: "girthIn",
    label: "Girth (in)",
    type: "number",
    hint: "Center of one shoulder, through the crotch, up to the same shoulder"
  },
  {
    key: "neckIn",
    label: "Neck (in)",
    type: "number",
    hint: "Around the base of the neck"
  },
  {
    key: "armLengthIn",
    label: "Arm Length (in)",
    type: "number",
    hint: "Shoulder to wrist"
  },
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
];

const EMPTY_MEASUREMENTS = {
  gender: "",
  height: "",
  weightLbs: "",
  chestIn: "",
  waistIn: "",
  hipsIn: "",
  inseamIn: "",
  backLengthIn: "",
  girthIn: "",
  neckIn: "",
  armLengthIn: "",
  shoeSize: "",
  gloveSize: "",
  shirtSize: "",
  notes: ""
};

function measurementsFromRow(row) {
  if (!row) return { ...EMPTY_MEASUREMENTS };
  return {
    gender: row.gender || "",
    height: row.height || "",
    weightLbs: row.weight_lbs ?? "",
    chestIn: row.chest_in ?? "",
    waistIn: row.waist_in ?? "",
    hipsIn: row.hips_in ?? "",
    inseamIn: row.inseam_in ?? "",
    backLengthIn: row.back_length_in ?? "",
    girthIn: row.girth_in ?? "",
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
      {status === "loading" ? <p className="portal-field-pending">Loading measurements...</p> : null}
      {formattedUpdated ? <p className="portal-field-note">Last updated {formattedUpdated}</p> : null}

      <div className="portal-measurement-grid">
        {MEASUREMENT_FIELDS.map((f) => (
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

function StudentCard({ student, onChanged }) {
  const guardians = student.guardians || [];
  const guardianCount = guardians.length;

  return (
    <section className="portal-section portal-student-card">
      <div className="portal-student-head">
        <h2>{student.displayName}</h2>
        <span className="portal-tag">{student.grade || "Grade not listed"}</span>
      </div>

      <EditableField
        field="student_preferred_first"
        studentId={student.id}
        label="Preferred name"
        value={student.preferredFirst || ""}
        placeholder="What they go by"
      />
      <EditableField
        field="student_cell_phone"
        studentId={student.id}
        label="Student cell phone"
        value={student.cellPhone || ""}
        placeholder="Add a cell number"
      />

      {student.note ? (
        <div className="portal-field">
          <span className="portal-field-label">Notes on file</span>
          <span className="portal-field-value">{student.note}</span>
          <span className="portal-field-note">Medical and travel details get their own forms soon. To change this now, message Mr. Parker.</span>
        </div>
      ) : null}

      <MeasurementsPanel studentId={student.id} />

      <div className="portal-guardians">
        <h3>Guardians</h3>
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
      </div>
    </section>
  );
}

function EditableField({ field, studentId, label, value, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [current, setCurrent] = useState(value);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrent(value);
    setDraft(value);
  }, [value]);

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
    <div className="portal-field">
      <span className="portal-field-label">{label}</span>
      {editing ? (
        <div className="portal-field-edit">
          <input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
          <button type="button" onClick={save} disabled={status === "saving"}>
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
      {status === "saved" ? <span className="portal-field-pending">{PENDING_NOTE}</span> : null}
      {error ? <span className="portal-field-error">{error}</span> : null}
    </div>
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
      setMessage(data.error || "Could not submit.");
      return;
    }
    setStatus("done");
    setMessage("Submitted. Mr. Parker will add this guardian after a quick review.");
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
          {status === "sending" ? "Submitting..." : "Submit for review"}
        </button>
        <p className="portal-consent-note">
          By submitting, you confirm this information is yours to share. See our{" "}
          <a href="/privacy">Privacy Notice</a>.
        </p>
        <button type="button" className="portal-link-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {message ? <span className={status === "done" ? "portal-field-pending" : "portal-field-error"}>{message}</span> : null}
    </form>
  );
}
