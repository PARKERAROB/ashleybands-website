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
      setState({ status: "error", message: data.error || "Profile access expired. Request a new link." });
      return;
    }
    setProfile(data);
    setState({ status: "ready", message: "" });
  }

  useEffect(() => {
    let cancelled = false;
    async function open() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (token) {
        const sessionRes = await fetch("/api/portal/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        if (!sessionRes.ok) {
          const data = await sessionRes.json().catch(() => ({}));
          if (!cancelled) setState({ status: "error", message: data.error || "This profile link could not be opened." });
          return;
        }
        window.history.replaceState({}, "", "/portal/review");
      }
      if (!cancelled) await loadProfile();
    }
    open();
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
  const students = (data.students || []).filter((s) => s.charges.length || s.payments.length);
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
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const canPayOnline = owes && paymentsEnabled && Boolean(clientId);

  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const amountRef = useRef(amount);
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  return (
    <article className="portal-student-card">
      <div className="portal-student-head">
        <h3>{student.name}</h3>
        <span className="portal-tag">{owes ? `Balance ${formatUsd(balanceCents)}` : "Paid in full"}</span>
      </div>

      <div className="portal-field">
        <span className="portal-field-label">Summary</span>
        <span className="portal-field-value">
          Charged {formatUsd(student.chargedCents)} · Paid {formatUsd(student.paidCents)} · Balance{" "}
          {formatUsd(balanceCents)}
        </span>
      </div>

      {student.charges.length ? (
        <div className="portal-field">
          <span className="portal-field-label">Charges</span>
          <ul className="portal-fee-list">
            {student.charges
              .filter((c) => c.status === "active")
              .map((c) => (
                <li key={c.id}>
                  {c.label} — {formatUsd(c.amountCents)}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {student.payments.length ? (
        <div className="portal-field">
          <span className="portal-field-label">Payments</span>
          <ul className="portal-fee-list">
            {student.payments.map((p) => (
              <li key={p.id}>
                {new Date(p.receivedAt).toLocaleDateString()} — {formatUsd(p.amountCents)} ({p.method})
              </li>
            ))}
          </ul>
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
        <button type="button" className="portal-link-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {message ? <span className={status === "done" ? "portal-field-pending" : "portal-field-error"}>{message}</span> : null}
    </form>
  );
}
