"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import InstrumentRequestSection from "./InstrumentRequestSection";
import PortalSectionIcon from "./PortalSectionIcon";
import PortalErrorMessage from "../PortalErrorMessage";
import { paypalGrossUpCents } from "@/lib/carnegieTripAccountMath.mjs";
import { NotesHomeCard } from "../carnegie-notes/CarnegieNotesClient";
import { PORTAL_SIGNED_OUT_MESSAGE, PORTAL_TROUBLE_MESSAGE, portalErrorText } from "@/lib/portalFamilyMessages";
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

const PAYMENT_METHOD_LABELS = {
  paypal: "Paid online (PayPal)",
  online: "Paid online",
  check: "Check",
  employer_platform: "Employer giving program",
  cash: "Cash",
  venmo: "Venmo",
  credit: "Credit",
  other: "Payment"
};

function paymentMethodLabel(method) {
  const key = String(method || "").trim().toLowerCase();
  return PAYMENT_METHOD_LABELS[key] || "Payment";
}

function formatUsd(cents) {
  return `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export default function PortalReviewClient({ carnegieNotesOpen = false }) {
  const [state, setState] = useState({ status: "loading", message: "Opening your profile..." });
  const [profile, setProfile] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [notesStudents, setNotesStudents] = useState([]);
  const [view, setView] = useState("home");

  // ?view= keeps each choice linkable and the browser Back button working (#237).
  useEffect(() => {
    const readView = () => {
      const requested = new URLSearchParams(window.location.search).get("view") || "home";
      setView(PORTAL_VIEWS.includes(requested) ? requested : "home");
    };
    readView();
    window.addEventListener("popstate", readView);
    return () => window.removeEventListener("popstate", readView);
  }, []);

  function openView(next) {
    const params = new URLSearchParams(window.location.search);
    if (next === "home") params.delete("view");
    else params.set("view", next);
    const query = params.toString();
    window.history.pushState({}, "", `/portal/review${query ? `?${query}` : ""}`);
    setView(next);
    window.scrollTo(0, 0);
  }

  async function loadProfile() {
    let res;
    try {
      res = await fetch("/api/portal/me");
    } catch {
      setState({ status: "error", message: PORTAL_TROUBLE_MESSAGE });
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState({ status: "error", message: res.status === 401 ? PORTAL_SIGNED_OUT_MESSAGE : PORTAL_TROUBLE_MESSAGE });
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

  // Music Notes card first (#204), only when the notes gate is open. A failed load shows no card.
  const signedIn = Boolean(profile);
  useEffect(() => {
    if (!carnegieNotesOpen || !signedIn) return undefined;
    let cancelled = false;
    fetch("/api/portal/carnegie-notes", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((json) => { if (!cancelled) setNotesStudents(json.students || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [carnegieNotesOpen, signedIn]);

  const students = profile?.students || [];
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || students[0] || null;
  const notesStudent = selectedStudent ? notesStudents.find((student) => student.id === selectedStudent.id) || null : null;

  return (
    <main className="portal-shell portal-review-shell">
      <section className="portal-family-page">
        <header className="portal-family-header">
          <div>
            <h1>Family Portal</h1>
            <p>
              Choose what you need below.
            </p>
          </div>
          {profile ? (
            <p className="portal-account-summary">
              Signed in as <strong>{profile.person?.display_name || profile.email}</strong>
              <span>{profile.email}</span>
            </p>
          ) : null}
        </header>
        {state.status === "loading" ? <p className="portal-message">{state.message}</p> : null}
        {state.status === "error" ? (
          <>
            <PortalErrorMessage as="p" className="portal-message error" message={state.message} />
            {state.message === PORTAL_TROUBLE_MESSAGE ? (
              <button
                type="button"
                className="portal-primary-action"
                onClick={() => {
                  setState({ status: "loading", message: "Opening your profile..." });
                  loadProfile();
                }}
              >
                Try again
              </button>
            ) : null}
          </>
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

            {/* Home screen of choices; each opens one focused view (#237). */}
            {view === "home" ? (
              <PortalHome student={selectedStudent} showNotes={Boolean(notesStudent)} openView={openView} />
            ) : (
              <button type="button" className="portal-back-link" onClick={() => openView("home")}>
                ← All choices
              </button>
            )}

            {view === "carnegie" ? (
              <div className="portal-workspace-main">
                <CarnegieCommitmentSection student={selectedStudent} notesOpen={carnegieNotesOpen} openView={openView} />
                <CarnegieAdultsSection student={selectedStudent} openView={openView} />
              </div>
            ) : null}

            {view === "payments" ? (
              <div className="portal-workspace-main">
                <BillingSection studentId={selectedStudent.id} studentName={selectedStudent.displayName} />
              </div>
            ) : null}

            {view === "notes" ? (
              <div className="portal-workspace-main">
                {notesStudent ? <MusicNotesSection student={notesStudent} /> : <p className="portal-muted-status">Music Notes is not open for this student.</p>}
                <GiftsNotPaymentsNote openView={openView} />
              </div>
            ) : null}

            {view === "info" ? (
              <div className="portal-family-workspace">
                <StudentRail
                  key={selectedStudent.id}
                  student={selectedStudent}
                  onChanged={loadProfile}
                />
                <div className="portal-workspace-main">
                  <ParticipationSection student={selectedStudent} onChanged={loadProfile} />
                  <UniformSection student={selectedStudent} />
                  <OnboardingSection student={selectedStudent} />
                </div>
              </div>
            ) : null}

            {view === "class" ? (
              <div className="portal-workspace-main">
                <StudentResourcesSection student={selectedStudent} />
                <InstrumentRequestSection student={selectedStudent} />
              </div>
            ) : null}

            {view === "more" ? (
              <FamilyResources studentId={selectedStudent.id} notesOpen={carnegieNotesOpen} senior={selectedStudent.grade === "12th Grade"} />
            ) : null}
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

function MusicNotesSection({ student }) {
  return (
    <section className="portal-music-notes" aria-labelledby="portal-music-notes-heading">
      <h2 id="portal-music-notes-heading">{student.firstName}&apos;s Music Notes</h2>
      <NotesHomeCard student={student} />
    </section>
  );
}

const PORTAL_VIEWS = ["home", "carnegie", "payments", "notes", "info", "class", "more"];

function PortalHome({ student, showNotes, openView }) {
  const name = student.preferredFirst || student.displayName;
  const tiles = [
    { view: "carnegie", title: "Carnegie Hall 2027", body: "Trip details, the family commitment, and what to pay." },
    { view: "payments", title: "Payments", body: `What is owed and paid for ${name}. Pay online or by check.` },
    showNotes ? { view: "notes", title: "Music Notes", body: `${name}'s link for supporters to give.` } : null,
    { view: "info", title: "Forms and info", body: "Contacts, participation, uniforms, and the student record." },
    { view: "class", title: "Class", body: "Locker, lock, tuner, and instrument requests." },
    { view: "more", title: "More", body: "Calendar, clothing, sponsorship, and other links." }
  ].filter(Boolean);
  return (
    <nav className="portal-home-grid" aria-label="Family portal choices">
      {tiles.map((tile) => (
        <button key={tile.view} type="button" className="portal-home-tile" onClick={() => openView(tile.view)}>
          <strong>{tile.title}</strong>
          <span>{tile.body}</span>
        </button>
      ))}
    </nav>
  );
}

function CarnegieCommitmentSection({ student, notesOpen, openView }) {
  return (
    <section className="portal-workspace-section portal-carnegie-hub" aria-labelledby="portal-carnegie-heading">
      <div className="portal-section-heading-copy">
        <h2 id="portal-carnegie-heading">Carnegie Hall 2027</h2>
        <p>New York, March 23–26, 2027. Performance March 25. Family payments for {student.displayName} are made in Payments. Gifts from supporters come in through Music Notes and lower what the family owes.</p>
      </div>
      <div className="portal-hub-actions">
      <button type="button" className="portal-action-link" onClick={() => openView("payments")}>See what is owed and pay</button>
      <Link className="portal-action-link" href={`/portal/carnegie-2027?studentId=${encodeURIComponent(student.id)}`}>Family commitment</Link>
      {notesOpen ? <button type="button" className="portal-action-link" onClick={() => openView("notes")}>Music Notes for supporters</button> : null}
      {notesOpen ? <Link className="portal-action-link" href="/portal/carnegie-notes">My Carnegie Notes and letters</Link> : null}
      <Link className="portal-action-link" href="/info/carnegie-questions">Carnegie questions and answers</Link>
      </div>
    </section>
  );
}

function GiftsNotPaymentsNote({ openView }) {
  return (
    <section className="portal-workspace-section" aria-labelledby="portal-gifts-heading">
      <div className="portal-section-heading-copy">
        <h2 id="portal-gifts-heading">Gifts, not family payments</h2>
        <p>Music Notes is for supporters: family, friends, and businesses who want to give. Their gifts are credited to your student and lower what your family owes. To pay your family&apos;s own amount, use Payments.</p>
      </div>
      <button type="button" className="portal-action-link" onClick={() => openView("payments")}>Go to Payments</button>
    </section>
  );
}

function OnboardingSection({ student }) {
  const complete = student.onboarding?.status === "complete";
  const started = Number(student.onboarding?.lastCompletedStep || 0) > 0;
  const label = complete ? "Review information" : started ? "Continue onboarding" : "Start onboarding";
  const href = student.onboardingAccessReady
    ? `/portal/onboarding?studentId=${encodeURIComponent(student.id)}`
    : `/portal/request?next=${encodeURIComponent(`/portal/onboarding?studentId=${student.id}`)}`;
  return (
    <section className="portal-workspace-section" aria-labelledby="portal-onboarding-heading">
      <div className="portal-section-heading-copy">
        <h2 id="portal-onboarding-heading">Career onboarding</h2>
        <p>{complete ? "The connected student record is complete. Update only what changed." : "Complete the student information Ashley Bands keeps throughout the student’s career."}</p>
      </div>
      <Link className="portal-action-link" href={href}>{student.onboardingAccessReady ? label : "Verify connection"}</Link>
    </section>
  );
}

function FamilyResources({ studentId, notesOpen, senior }) {
  return (
    <nav className="portal-family-resources" aria-label="Family resources">
      <strong>Family resources</strong>
      <Link href={`/portal/carnegie-2027?studentId=${encodeURIComponent(studentId)}`}>Carnegie Hall commitment</Link>
      <Link href="/info/carnegie-questions">Carnegie questions and answers</Link>
      {notesOpen ? <Link href="/portal/carnegie-notes">My Carnegie Notes and letters</Link> : null}
      <Link href={`/portal/clothing?studentId=${encodeURIComponent(studentId)}`}>Open House clothing order</Link>
      <Link href="/portal/sponsorship">Business sponsorship</Link>
      <Link href="/info/marching-band-2026">Marching Band information</Link>
      <Link href="/calendar">Band calendar</Link>
      {senior ? <Link href="/portal/senior-night">Senior Night form (seniors sign in with their own school email)</Link> : null}
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
        setError(portalErrorText(res, json, "Could not load fees."));
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
      .then((r) => r.json().catch(() => ({})).then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(portalErrorText(r, j, "Could not load fees."));
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
  // A trip student with no other band fees still has a Carnegie account to show (#239).
  const hasActivity = Boolean(
    student && (student.charges.length || student.payments.length || student.springTripRefund
      || student.carnegieTrip || student.carnegieAdults)
  );

  return (
    <section className="portal-workspace-section" aria-labelledby="portal-funding-heading">
      <div className="portal-section-heading">
        <PortalSectionIcon type="funding" />
        <div className="portal-section-heading-copy">
          <h2 id="portal-funding-heading">Payments</h2>
          <p>What is due for {studentName}, and what has been paid.</p>
        </div>
      </div>
      <PortalErrorMessage as="p" message={error} />
      {!data && !error ? <p className="portal-muted-status">Loading financial record…</p> : null}
      {data && !hasActivity ? (
        <p className="portal-muted-status">Nothing is due, and no payments are listed yet.</p>
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
  // Carnegie charges and payments live in the trip account below, not in Due now (#237).
  const activeCharges = (student.charges || []).filter((c) => c.status === "active" && !isCarnegieCategory(c.category));
  const allPayments = (student.payments || []).filter((p) => !isCarnegieCategory(p.category));
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
  const calculatedGoal = kindTotals("funding_goal");
  const goal = student.campaign ? {
    ...calculatedGoal,
    charged: Number(student.campaign.goalCents) || 0,
    paid: Number(student.campaign.raisedCents) || 0,
    sponsorship: (Number(student.campaign.confirmedGiftCents) || 0) + (Number(student.campaign.countedLedgerSponsorshipCents) || 0),
    remaining: Number(student.campaign.remainingCents) || 0,
  } : calculatedGoal;
  const fee = kindTotals("fee");
  const balanceCents = fee.remaining;
  const owes = balanceCents > 0;
  const hasGoal = goal.charges.length > 0 || goal.charged > 0 || goal.paid > 0;
  const hasFee = fee.charges.length > 0 || fee.paid > 0;
  const feeCategories = [...new Set(fee.charges.map((charge) => charge.category).filter(Boolean))];
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const canPayOnline = owes && paymentsEnabled && Boolean(clientId) && feeCategories.length === 1;

  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const amountRef = useRef(amount);
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  // Marching band goal contributions (#167): any amount up to what remains.
  const canContributeOnline = goal.remaining > 0 && paymentsEnabled && Boolean(clientId);
  const [showGive, setShowGive] = useState(false);
  const [giveAmount, setGiveAmount] = useState((goal.remaining / 100).toFixed(2));
  const giveAmountRef = useRef(giveAmount);
  useEffect(() => {
    giveAmountRef.current = giveAmount;
  }, [giveAmount]);

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
        setForgoError(portalErrorText(res, json, "Could not save your choice. Please try again."));
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
      {student.carnegieTrip ? (
        <CarnegieTripAccount
          account={student.carnegieTrip}
          studentId={student.id}
          studentName={student.name}
          paymentsEnabled={paymentsEnabled}
          onPaid={onPaid}
        />
      ) : null}

      {student.carnegieAdults ? (
        <CarnegieAdultAccount
          account={student.carnegieAdults}
          studentId={student.id}
          paymentsEnabled={paymentsEnabled}
          onPaid={onPaid}
        />
      ) : null}

      {/* What is due comes first, then what has been paid, then goals (#237). */}
      {owes || !student.carnegieTrip ? (
      <div className={`portal-due-panel${owes ? " portal-due-panel-owes" : ""}`}>
        <span className="portal-field-label">{student.carnegieTrip ? "Other band fees due" : "Due now"}</span>
        {owes ? (
          <>
            <strong className="portal-due-amount">{formatUsd(balanceCents)}</strong>
            <ul className="portal-fee-list">
              {fee.charges.map((c) => (
                <li key={c.id}>{c.label}: {formatUsd(c.amountCents)}</li>
              ))}
            </ul>
            {fee.paid > 0 ? <span className="portal-field-note">{formatUsd(fee.paid)} already paid toward these.</span> : null}
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
              category={feeCategories[0]}
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
      ) : owes ? (
        <p className="portal-field-note">To pay this balance, mail a check payable to Ashley High School Band Boosters, or email Mr. Parker for an online payment link.</p>
      ) : null}

            <span className="portal-field-note">
              Or pay by check to Ashley Band Boosters, with {student.name}&rsquo;s name and what it is for in the memo line.
            </span>
          </>
        ) : (
          <strong className="portal-due-amount">Nothing is due right now</strong>
        )}
      </div>
      ) : null}

      <GiftLedger gifts={student.gifts || []} />

      {allPayments.some((p) => !p.isSponsorship) ? (
        <div className="portal-field">
          <span className="portal-field-label">Family payments</span>
          <ul className="portal-fee-list">
            {allPayments.filter((p) => !p.isSponsorship).map((p) => (
              <li key={p.id}>
                {new Date(p.receivedAt).toLocaleDateString()}: {formatUsd(p.amountCents)}{" "}
                {p.isSponsorship ? `gift${p.payerName ? ` from ${p.payerName}` : ""}` : p.category === "carnegie_2027_conditional_deposit" ? `Carnegie deposit, ${paymentMethodLabel(p.method)}` : `payment, ${paymentMethodLabel(p.method)}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasGoal ? (
        <div className="portal-field">
          <span className="portal-field-label">Marching Band season goal</span>
          <dl className="portal-ledger">
            <div><dt>Season goal</dt><dd>{formatUsd(goal.charged)}</dd></div>
            {goal.sponsorship > 0 ? <div><dt>Gifts from sponsors</dt><dd>{formatUsd(goal.sponsorship)}</dd></div> : null}
            {goal.paid - goal.sponsorship > 0 ? <div><dt>Family payments and fundraising</dt><dd>{formatUsd(goal.paid - goal.sponsorship)}</dd></div> : null}
            <div className="portal-ledger-total"><dt>Still to raise</dt><dd>{formatUsd(goal.remaining)}</dd></div>
          </dl>
          <span className="portal-field-note">
            A goal, not a bill.{goal.paid > goal.charged ? ` ${formatUsd(goal.paid - goal.charged)} was raised beyond the goal.` : ""}
          </span>
          {goal.remaining > 0 ? (
            <>
              {canContributeOnline ? (
                showGive ? (
                  <div className="portal-field-edit portal-pay-form">
                    <label className="portal-field-label" htmlFor={`give-${student.id}`}>
                      Amount to contribute (any amount up to {formatUsd(goal.remaining)})
                    </label>
                    <input
                      id={`give-${student.id}`}
                      type="number"
                      min="1"
                      step="0.01"
                      value={giveAmount}
                      onChange={(e) => setGiveAmount(e.target.value)}
                    />
                    <PayPalButton
                      clientId={clientId}
                      studentId={student.id}
                      kind="funding_goal"
                      amountRef={giveAmountRef}
                      onPaid={() => {
                        setShowGive(false);
                        if (onPaid) onPaid();
                      }}
                    />
                  </div>
                ) : (
                  <button type="button" className="portal-primary-action" onClick={() => setShowGive(true)}>
                    Contribute online
                  </button>
                )
              ) : null}
              <span className="portal-field-note">
                Checks work too. Make them payable to Ashley High School Band Boosters and write {student.name}&rsquo;s name on the memo line.
              </span>
            </>
          ) : null}
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
              <PortalErrorMessage className="portal-field-note portal-error-text" message={forgoError} />
            </>
          )}
        </div>
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
            <PortalErrorMessage as="p" className="portal-modal-error" message={forgoError} />
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

function isCarnegieCategory(category) {
  return String(category || "").startsWith("carnegie_2027");
}

function formatDueDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

// Carnegie trip account (#237): the $2,000 share, what counts against it, and pay-any-amount.
function CarnegieTripAccount({ account, studentId, studentName, paymentsEnabled, onPaid }) {
  const suggested = account.firstPaymentOwedCents || account.owedCents;

  return (
    <>
    <div className={`portal-due-panel${account.owedCents > 0 ? " portal-due-panel-owes" : ""}`}>
      <h3 className="portal-due-title">Carnegie Hall 2027 trip</h3>
      {account.firstPaymentOwedCents > 0 ? (
        <>
          <strong className="portal-due-amount">{formatUsd(account.firstPaymentOwedCents)} due by {formatDueDate(account.firstPaymentDue)}</strong>
          <span className="portal-field-note">First payment of {formatUsd(account.firstPaymentCents)}, $50 deposit included. Gifts for {studentName} count toward it.</span>
        </>
      ) : (
        <strong className="portal-due-amount">{account.owedCents > 0 ? "First payment met" : "Trip share paid in full"}</strong>
      )}

      <dl className="portal-ledger">
        <div><dt>Trip share</dt><dd>{formatUsd(account.shareCents)}</dd></div>
        <div><dt>Gifts given for {studentName}</dt><dd>−{formatUsd(account.giftCents)}</dd></div>
        <div><dt>Family payments</dt><dd>−{formatUsd(account.familyCents)}</dd></div>
        <div className="portal-ledger-total"><dt>Still owed</dt><dd>{formatUsd(account.owedCents)}</dd></div>
      </dl>

      {account.owedCents > 0 ? (
        <CarnegiePayOptions
          studentId={studentId}
          category="carnegie_2027_trip"
          reported={account.reported || []}
          suggestedCents={suggested}
          maxCents={account.owedCents}
          memo={`${studentName}, Carnegie`}
          paymentsEnabled={paymentsEnabled}
          onPaid={onPaid}
        />
      ) : null}

    </div>
    <div className="portal-trip-details">
      {account.gifts.length ? (
        <>
          <span className="portal-field-label">Gifts given for {studentName}</span>
          <GiftTable gifts={account.gifts} />
        </>
      ) : null}
      {account.familyPayments.length ? (
        <>
          <span className="portal-field-label">Family payments</span>
          <ul className="portal-fee-list">
            {account.familyPayments.map((p) => (
              <li key={p.id}>
                {p.receivedAt ? new Date(p.receivedAt).toLocaleDateString() : "—"}: {formatUsd(p.amountCents)} {p.label.toLowerCase()}, {paymentMethodLabel(p.method)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <span className="portal-field-note">
        Gifts to the whole trip, such as business sponsors, lower the cost for every student. They are applied to everyone later and don&apos;t appear here.
      </span>
    </div>
    </>
  );
}

function adultSummary(adult) {
  if (adult.travelOption !== "with_band") return "Option 3: fully on our own";
  const role = adult.officialChaperone
    ? "Option 1: official chaperone, confirmed by Mr. Parker"
    : adult.chaperoneInterest
      ? "Option 1 requested (not yet confirmed; plan your own travel for now)"
      : "Option 2: with the band, own travel";
  const room = adult.roomType === "quad" ? "quad" : "double";
  return `${role} · ${room} · ${formatUsd(adult.priceCents)}`;
}

// Adults coming to New York (#237): the family adds adults here; Mr. Parker names official chaperones.
function CarnegieAdultsSection({ student, openView }) {
  const [account, setAccount] = useState(null);
  const [adding, setAdding] = useState(false);
  const blankAdult = { adultName: "", choice: "with_band", roomType: "double", termsAccepted: false };
  const [form, setForm] = useState(blankAdult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : {}))
      .then((json) => {
        if (cancelled) return;
        const row = (json.students || []).find((item) => item.id === student.id);
        setAccount(row?.carnegieAdults || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [student.id]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal/carnegie-adults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          adultName: form.adultName,
          // Option 1 is a request to chaperone; it is priced and planned as a double with the band.
          travelOption: form.choice === "own_way" ? "own_way" : "with_band",
          roomType: form.choice === "chaperone" ? "double" : form.roomType,
          chaperoneInterest: form.choice === "chaperone",
          termsAccepted: form.termsAccepted,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(portalErrorText(res, json, "The adult could not be saved."));
        return;
      }
      setAccount(json.account);
      setAdding(false);
      setForm(blankAdult);
    } catch {
      setError("The adult could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const withBand = form.choice !== "own_way";
  return (
    <section className="portal-workspace-section" aria-labelledby="portal-adults-heading">
      <div className="portal-section-heading-copy">
        <h2 id="portal-adults-heading">Adults coming to New York</h2>
        <p>There are three ways for an adult to come to New York, March 23–26, 2027.</p>
        <ol className="portal-adult-options">
          <li><strong>Ask to be an official chaperone: $2,500</strong> (double room). Chaperones travel with the band on the bus and get everything the students get, and they supervise students the whole trip. <strong>This is a request, not a guarantee.</strong> Mr. Parker decides based on a number of factors, including how many men and women are needed. Until he confirms you, plan to get to New York on your own (option 2). Confirmed chaperones pay in full, are approved as NHCS Level 2 volunteers by December 10, and sign the <Link href="/info/carnegie-chaperone-agreement">chaperone agreement</Link>.</li>
          <li><strong>With the band, own travel: $2,500</strong> in a double, or <strong>$2,000</strong> in a quad when all four beds are filled. You get the hotel, meals on the itinerary, the group&apos;s activities, and the Carnegie Hall performance. You get yourself to and from New York.</li>
          <li><strong>Fully on your own: no cost through the band.</strong> You plan everything, including your Carnegie Hall ticket. Just let us know you&apos;re coming.</li>
        </ol>
      </div>

      {account?.adults?.length ? (
        <ul className="portal-fee-list">
          {account.adults.map((adult) => (
            <li key={adult.id}><strong>{adult.name}</strong>: {adultSummary(adult)}</li>
          ))}
        </ul>
      ) : null}
      {account?.owedCents > 0 ? (
        <button type="button" className="portal-action-link" onClick={() => openView("payments")}>Pay for adult travel</button>
      ) : null}

      {adding ? (
        <form className="portal-adult-form" onSubmit={save}>
          <label className="portal-field-label" htmlFor="adult-name">Adult&apos;s full name</label>
          <input id="adult-name" value={form.adultName} onChange={set("adultName")} required />

          <fieldset>
            <legend className="portal-field-label">Which option?</legend>
            <label><input type="radio" name="choice" value="chaperone" checked={form.choice === "chaperone"} onChange={set("choice")} /> Option 1: ask to be an official chaperone (not guaranteed)</label>
            <label><input type="radio" name="choice" value="with_band" checked={form.choice === "with_band"} onChange={set("choice")} /> Option 2: with the band, own travel to New York</label>
            <label><input type="radio" name="choice" value="own_way" checked={form.choice === "own_way"} onChange={set("choice")} /> Option 3: fully on our own</label>
          </fieldset>

          {withBand ? (
            <>
              {form.choice === "chaperone" ? (
                <p className="portal-field-note">Chaperones stay in a double room: $2,500 per person.</p>
              ) : (
              <fieldset>
                <legend className="portal-field-label">Room</legend>
                <label><input type="radio" name="roomType" value="double" checked={form.roomType === "double"} onChange={set("roomType")} /> Double (two adults): $2,500 per person</label>
                <label><input type="radio" name="roomType" value="quad" checked={form.roomType === "quad"} onChange={set("roomType")} /> Quad (four adults): $2,000 per person, only if all four beds are filled. Otherwise it becomes a double at $2,500.</label>
              </fieldset>
              )}
              <div className="portal-terms">
                <strong>Payment terms</strong>
                <ul>
                  <li>Pay in any amounts. <strong>Every payment is non-refundable.</strong> The band commits money to WorldStrides on your behalf.</li>
                  <li>Please pay in full by <strong>Monday, November 23</strong>. The final deadline is <strong>Thursday, December 10</strong>. No one can be added after that.</li>
                  <li>You go on the travel company&apos;s list only once you have paid in full.</li>
                  <li>If you don&apos;t travel, what you paid stays with the Ashley Band Boosters until Mr. Parker talks with you.</li>
                </ul>
                <label><input type="checkbox" checked={form.termsAccepted} onChange={set("termsAccepted")} /> I understand and accept these terms.</label>
              </div>
            </>
          ) : null}
          <PortalErrorMessage as="p" message={error} />
          <div className="portal-hub-actions">
            <button type="submit" className="portal-primary-action" disabled={busy}>{busy ? "Saving…" : "Add this adult"}</button>
            <button type="button" className="portal-action-link" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="portal-primary-action" onClick={() => setAdding(true)}>Add an adult</button>
      )}
    </section>
  );
}

// Adult travel account (#237): separate from the student's trip share.
function CarnegieAdultAccount({ account, studentId, paymentsEnabled, onPaid }) {
  if (!account.totalCents && !account.paidCents) return null;

  return (
    <div className={`portal-due-panel${account.owedCents > 0 ? " portal-due-panel-owes" : ""}`}>
      <h3 className="portal-due-title">Carnegie Hall 2027 adult travel</h3>
      <strong className="portal-due-amount">{account.owedCents > 0 ? `${formatUsd(account.owedCents)} still owed` : "Paid in full"}</strong>
      {account.owedCents > 0 ? <span className="portal-field-note">Please pay in full by {formatDueDate(account.preferredDue)}. Final deadline {formatDueDate(account.cutoff)}. Every payment is non-refundable.</span> : null}
      <dl className="portal-ledger">
        {account.adults.filter((adult) => adult.priceCents > 0).map((adult) => (
          <div key={adult.id}><dt>{adult.name} ({adult.roomType})</dt><dd>{formatUsd(adult.priceCents)}</dd></div>
        ))}
        <div><dt>Paid</dt><dd>−{formatUsd(account.paidCents)}</dd></div>
        <div className="portal-ledger-total"><dt>Still owed</dt><dd>{formatUsd(account.owedCents)}</dd></div>
      </dl>
      {account.owedCents > 0 ? (
        <CarnegiePayOptions
          studentId={studentId}
          category="carnegie_2027_adult"
          reported={account.reported || []}
          suggestedCents={account.owedCents}
          maxCents={account.owedCents}
          memo="Carnegie adult travel, and the adult's name"
          nonRefundable
          paymentsEnabled={paymentsEnabled}
          onPaid={onPaid}
        />
      ) : null}
    </div>
  );
}

// The family records a check or cash they handed in (#237): a note-received email now, and a
// final receipt when the Boosters deposit it. Nothing is credited until then.
function ReportCheckOrCash({ studentId, category, open, onOpen, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ method: "check", amount: "", checkNumber: "", handedInOn: today });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal/carnegie-payment-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          category,
          method: form.method,
          amountCents: Math.round((Number(form.amount) || 0) * 100),
          checkNumber: form.checkNumber,
          handedInOn: form.handedInOn,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(portalErrorText(res, json, "The payment note could not be saved."));
        return;
      }
      setMessage("Recorded. Check your email for a note; you'll get a final receipt once it's deposited.");
      onClose();
      setForm({ method: "check", amount: "", checkNumber: "", handedInOn: today });
      if (onSaved) onSaved();
    } catch {
      setError("The payment note could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        {message ? <span className="portal-field-note">{message}</span> : null}
        <button type="button" className="portal-action-link" onClick={() => { setMessage(""); onOpen(); }}>Record a check or cash I turned in</button>
      </>
    );
  }
  return (
    <form className="portal-report-form" onSubmit={save}>
      <label><input type="radio" name={`method-${category}`} value="check" checked={form.method === "check"} onChange={set("method")} /> Check</label>
      <label><input type="radio" name={`method-${category}`} value="cash" checked={form.method === "cash"} onChange={set("method")} /> Cash</label>
      <label className="portal-field-label">Amount<input type="number" min="1" step="0.01" value={form.amount} onChange={set("amount")} required /></label>
      {form.method === "check" ? (
        <label className="portal-field-label">Check number<input value={form.checkNumber} onChange={set("checkNumber")} required /></label>
      ) : null}
      <label className="portal-field-label">Date turned in<input type="date" value={form.handedInOn} onChange={set("handedInOn")} required /></label>
      <PortalErrorMessage as="p" message={error} />
      <div className="portal-hub-actions">
        <button type="submit" className="portal-primary-action" disabled={busy}>{busy ? "Saving…" : "Record it"}</button>
        <button type="button" className="portal-action-link" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

// How to pay toward a Carnegie account (#237). Rob, 2026-10-27: check or cash first; online
// payers can cover PayPal's fee, and if they don't, a small amount still shows as owed.
function CarnegiePayOptions({ studentId, category, reported = [], suggestedCents, maxCents, memo, nonRefundable = false, paymentsEnabled, onPaid }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const canPayOnline = paymentsEnabled && Boolean(clientId);
  // One choice open at a time: recording a check/cash, or paying online (#237).
  const [mode, setMode] = useState("");
  const showPay = mode === "online";
  const [amount, setAmount] = useState((suggestedCents / 100).toFixed(2));
  const [coverFee, setCoverFee] = useState(true);
  const netCents = Math.min(Math.round((Number(amount) || 0) * 100), maxCents);
  const feeCents = coverFee && netCents > 0 ? paypalGrossUpCents(netCents) - netCents : 0;
  const totalCents = netCents + feeCents;
  const amountRef = useRef((totalCents / 100).toFixed(2));
  useEffect(() => {
    amountRef.current = (totalCents / 100).toFixed(2);
  }, [totalCents]);

  return (
    <div className="portal-pay-options">
      <p><strong>Best: pay by check or cash.</strong> No fees, so every dollar counts. Checks payable to Ashley Band Boosters, with {memo} in the memo line. Turn it in to Mr. Parker, then record it below for a receipt.</p>
      {reported.length ? (
        <ul className="portal-fee-list">
          {reported.map((r) => (
            <li key={r.id}>{formatUsd(r.amountCents)} {r.method === "check" ? `check #${r.checkNumber}` : "cash"}: recorded {new Date(r.reportedAt).toLocaleDateString()}, waiting for deposit</li>
          ))}
        </ul>
      ) : null}
      {mode !== "online" ? (
        <ReportCheckOrCash
          studentId={studentId}
          category={category}
          open={mode === "record"}
          onOpen={() => setMode("record")}
          onClose={() => setMode("")}
          onSaved={onPaid}
        />
      ) : null}
      {canPayOnline ? (
        showPay ? (
          <div className="portal-field-edit portal-pay-form">
            <label className="portal-field-label" htmlFor={`pay-${category}-${studentId}`}>
              Amount toward the balance (any amount up to {formatUsd(maxCents)})
            </label>
            <input id={`pay-${category}-${studentId}`} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <label>
              <input type="checkbox" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} /> Add PayPal&apos;s fee ({formatUsd(feeCents || (netCents > 0 ? paypalGrossUpCents(netCents) - netCents : 0))}) so the full amount counts
            </label>
            <span className="portal-field-note">
              {coverFee
                ? `You pay ${formatUsd(totalCents)}; ${formatUsd(netCents)} is credited.`
                : `PayPal keeps about 3% plus $0.49, so about ${formatUsd(Math.max(netCents - (paypalGrossUpCents(netCents) - netCents), 0))} is credited and a small amount will still show as owed.`}
              {nonRefundable ? " Non-refundable." : ""}
            </span>
            <PayPalButton
              clientId={clientId}
              studentId={studentId}
              category={category}
              amountRef={amountRef}
              onPaid={() => {
                setMode("");
                if (onPaid) onPaid();
              }}
            />
            <button type="button" className="portal-action-link" onClick={() => setMode("")}>Cancel</button>
          </div>
        ) : mode === "" ? (
          <button type="button" className="portal-action-link" onClick={() => setMode("online")}>Pay online instead</button>
        ) : null
      ) : null}
    </div>
  );
}

function GiftLedger({ gifts }) {
  if (!gifts.length) return null;
  const missingFee = gifts.some((g) => g.online && g.paypalFeeCents == null);
  return (
    <div className="portal-field">
      <span className="portal-field-label">Marching Band gifts credited to this student</span>
      <GiftTable gifts={gifts} />
      <span className="portal-field-note">The goal counts the full gift. &ldquo;Received&rdquo; is what reached the Boosters after PayPal&apos;s fee.{missingFee ? " A fee not yet recorded shows as “Not recorded.”" : ""}</span>
    </div>
  );
}

function GiftTable({ gifts }) {
  const gross = gifts.reduce((t, g) => t + g.amountCents, 0);
  const fees = gifts.reduce((t, g) => t + (g.paypalFeeCents || 0), 0);
  const missingFee = gifts.some((g) => g.online && g.paypalFeeCents == null);
  return (
    <table className="portal-gift-ledger">
      <thead>
        <tr><th scope="col">Date</th><th scope="col">From</th><th scope="col">Gift</th><th scope="col">PayPal fee</th><th scope="col">Received</th></tr>
      </thead>
      <tbody>
        {gifts.map((g) => (
          <tr key={g.id}>
            <td>{g.receivedAt ? new Date(g.receivedAt).toLocaleDateString() : "—"}</td>
            <td>{g.from}<small>{g.online ? "Online" : g.method === "check" ? "Check" : g.method}</small></td>
            <td>{formatUsd(g.amountCents)}</td>
            <td>{g.online ? (g.paypalFeeCents == null ? "Not recorded" : `−${formatUsd(g.paypalFeeCents)}`) : "None"}</td>
            <td>{g.online && g.paypalFeeCents == null ? "—" : formatUsd(g.amountCents - (g.paypalFeeCents || 0))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr><th scope="row" colSpan={2}>Total</th><td>{formatUsd(gross)}</td><td>{fees ? `−${formatUsd(fees)}` : "—"}</td><td>{missingFee ? "—" : formatUsd(gross - fees)}</td></tr>
      </tfoot>
    </table>
  );
}

function PayPalButton({ clientId, studentId, category, kind, amountRef, onPaid }) {
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
              body: JSON.stringify({ studentId, amountCents, category, kind })
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
            if (json.status === "pending") {
              setStatus("PayPal is still processing this payment. Your balance will update when it clears.");
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
  }, [clientId, studentId, category, kind, amountRef, onPaid]);

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
      { key: "height", label: "Height", type: "text", placeholder: "e.g. 5-9", hint: "feet-inches, e.g. 5-9 for 5 ft 9 in" }
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
        setError(portalErrorText(res, data, "Could not load measurements."));
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
      setError(portalErrorText(res, data, "Could not save measurements."));
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
                <label className="portal-field-label" htmlFor={`measure-${studentId}-${f.key}`}>{f.label}</label>
                <input
                  id={`measure-${studentId}-${f.key}`}
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
          <label className="portal-field-label" htmlFor={`measure-${studentId}-notes`}>Notes</label>
          <textarea
            id={`measure-${studentId}-notes`}
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
      <PortalErrorMessage message={error} />
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
        Changes take effect immediately. Removing a guardian here removes their access to this student only. <Link href="/privacy">Privacy Notice</Link>
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
      setError(portalErrorText(response, data, "Could not submit the request."));
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
      <PortalErrorMessage message={error} />
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
      setError(portalErrorText(response, data, "Could not withdraw the request."));
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
      <PortalErrorMessage message={error} />
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
      setMessage(portalErrorText(failed, data, "Could not save all student details."));
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
        <PortalErrorMessage message={message} />
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
      setError(portalErrorText(res, data, "Could not save."));
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
      <PortalErrorMessage message={error} />
    </div>
  );
}

function GuardianEdit({ guardian, studentId, studentName, onSaved }) {
  const [open, setOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
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
      setMessage(portalErrorText(res, data, "Could not update this guardian."));
      return;
    }
    setStatus("saved");
    setMessage("Family contact updated.");
    setOpen(false);
    if (onSaved) await onSaved();
  }

  async function removeGuardian() {
    setStatus("removing");
    setMessage("");
    const res = await fetch("/api/portal/guardian-request", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, guardianId: guardian.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("idle");
      setMessage(portalErrorText(res, data, "Could not remove this guardian."));
      return;
    }
    setStatus("removed");
    setConfirmingRemove(false);
    if (onSaved) await onSaved();
  }

  if (confirmingRemove) {
    return (
      <div className="portal-guardian-remove-confirm" role="group" aria-label={`Remove ${guardian.name} as a guardian`}>
        <p>
          Remove {guardian.name} from {studentName}? They will no longer have access to this student through this family record. Other students are not affected.
        </p>
        <div className="portal-guardian-actions">
          <button type="button" className="portal-danger-btn" disabled={status === "removing"} onClick={removeGuardian}>
            {status === "removing" ? "Removing..." : "Yes, remove guardian"}
          </button>
          <button type="button" className="portal-link-btn" disabled={status === "removing"} onClick={() => { setConfirmingRemove(false); setMessage(""); }}>
            Keep guardian
          </button>
        </div>
        <PortalErrorMessage message={message} />
      </div>
    );
  }

  if (!open) {
    return (
      <div className="portal-guardian-actions">
        <button type="button" className="portal-link-btn portal-guardian-edit" onClick={() => setOpen(true)}>Edit contact</button>
        <button type="button" className="portal-link-btn portal-remove-link" onClick={() => setConfirmingRemove(true)}>Remove guardian</button>
      </div>
    );
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
      <PortalErrorMessage className={status === "saved" ? "portal-field-pending" : "portal-field-error"} message={message} />
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
      setMessage(portalErrorText(res, data, "Could not add this guardian."));
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
      <PortalErrorMessage className={status === "done" ? "portal-field-pending" : "portal-field-error"} message={message} />
    </form>
  );
}
