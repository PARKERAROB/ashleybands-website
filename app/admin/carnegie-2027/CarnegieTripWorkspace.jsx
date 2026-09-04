"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import {
  CARNEGIE_AMOUNT_BANDS,
  CARNEGIE_DEPOSIT_CHOICES,
  CARNEGIE_HELP_OPTIONS,
  CARNEGIE_RESPONSE_OPTIONS,
  carnegieAmountBandLabel,
  carnegieDepositChoiceLabel,
  carnegieResponseLabel,
} from "@/lib/carnegieTripConstants";
import styles from "./carnegie-workspace.module.css";

const depositLabels = { received: "Received", payment_pending: "Payment pending", unable_now: "Cannot pay at this time", refunded: "Refunded", not_requested: "Not requested" };
const sourceLabels = { public: "Public form", portal: "Family Portal", staff_verbal: "Staff verbal" };
const followUpLabels = { none: "No follow-up set", login_help: "Login help", contact_needed: "Contact needed", complete: "Complete" };
const eligibilityLabels = { not_reviewed: "Not reviewed", preapproved: "Preapproved", approved: "Approved", needs_review: "Needs review", not_approved: "Not approved" };

const displayDate = (value) => value ? new Date(value).toLocaleString() : "—";
const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function CarnegieTripWorkspace() {
  return <StaffGate>{() => <CarnegieTripWorkspaceContent />}</StaffGate>;
}

function CarnegieTripWorkspaceContent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [responseFilter, setResponseFilter] = useState("all");
  const [depositFilter, setDepositFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [showVerbal, setShowVerbal] = useState(false);

  async function load() {
    setError("");
    const response = await fetch("/api/admin/carnegie-2027");
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Could not load the workspace."); return; }
    setData(body);
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (data?.rows || []).filter((row) => {
      const haystack = [row.student.display_name, row.student.ensemble_2026, row.contact.name, row.contact.email].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (responseFilter === "all" || (responseFilter === "missing" ? !row.submission : row.submission?.response === responseFilter))
        && (depositFilter === "all" || row.depositStatus === depositFilter)
        && (followUpFilter === "all" || row.tracking.follow_up_status === followUpFilter);
    });
    return filtered.sort((a, b) => {
      if (sort === "ensemble") return String(a.student.ensemble_2026 || "").localeCompare(String(b.student.ensemble_2026 || "")) || a.student.display_name.localeCompare(b.student.display_name);
      if (sort === "response") return String(a.submission?.response || "zz").localeCompare(String(b.submission?.response || "zz"));
      if (sort === "deposit") return String(a.depositStatus).localeCompare(String(b.depositStatus));
      if (sort === "updated") return String(b.submission?.created_at || "").localeCompare(String(a.submission?.created_at || ""));
      return a.student.display_name.localeCompare(b.student.display_name);
    });
  }, [data, search, responseFilter, depositFilter, followUpFilter, sort]);

  const metrics = useMemo(() => {
    const all = data?.rows || [];
    return {
      yes: all.filter((row) => row.submission?.response === "serious_yes").length,
      paid: all.filter((row) => row.depositStatus === "received").length,
      unableNow: all.filter((row) => row.depositStatus === "unable_now").length,
      collected: all.filter((row) => row.depositStatus === "received").reduce((sum, row) => sum + Number(row.completedPayment?.amount_cents || 0), 0),
      interested: all.filter((row) => row.submission?.response === "interested_limited").length,
      no: all.filter((row) => row.submission?.response === "no").length,
      missing: all.filter((row) => !row.submission).length,
      followUp: all.filter((row) => !["none", "complete"].includes(row.tracking.follow_up_status)).length,
    };
  }, [data]);

  function downloadCsv() {
    const columns = ["Student","Ensemble","Response","Agreement version","Source","Submitted","Guardian","Email","Phone","Maximum amount","Deposit choice","Help offered","Deposit","Follow-up","Eligibility","Staff note"];
    const quote = (input) => `"${String(input ?? "").replaceAll('"','""')}"`;
    const lines = rows.map((row) => [
      row.student.display_name, row.student.ensemble_2026, carnegieResponseLabel(row.submission?.response, row.submission?.agreement_version), row.submission?.agreement_version || "", sourceLabels[row.submission?.source] || "",
      row.submission?.created_at || "", row.contact.name, row.contact.email, row.contact.phone,
      carnegieAmountBandLabel(row.submission?.maximum_family_amount_band, row.submission?.agreement_version), carnegieDepositChoiceLabel(row.submission?.deposit_choice, row.submission?.agreement_version, row.submission?.response), (row.submission?.help_options || []).map((value) => CARNEGIE_HELP_OPTIONS.find((item) => item.value === value)?.label || value).join("; "),
      depositLabels[row.depositStatus], followUpLabels[row.tracking.follow_up_status], eligibilityLabels[row.tracking.eligibility_status], row.tracking.staff_note,
    ].map(quote).join(","));
    const blob = new Blob([[columns.map(quote).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "carnegie-2027-commitments.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!data) return <main className={styles.page}><header><p className={styles.eyebrow}>Ashley Bands staff</p><h1>Carnegie commitment sheet</h1><p>{error || "Loading responses and connected financial records…"}</p><Link href="/admin">← Staff command center</Link></header></main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Ashley Bands staff · private</p><h1>Carnegie commitment sheet</h1><p>Family responses, $50 ledger status, eligibility, and follow-up in one sortable workspace.</p></div>
        <div className={styles.headerActions}><Link href="/admin">Command center</Link><Link href="/admin/financial">Financial portal</Link><button type="button" onClick={downloadCsv}>Download filtered CSV</button><button type="button" className={styles.primary} onClick={() => setShowVerbal((value) => !value)}>Record verbal commitment</button></div>
      </header>

      <section className={styles.metrics} aria-label="Commitment summary">
        <Metric label="Serious yes" value={metrics.yes} />
        <Metric label="$50 received" value={metrics.paid} note={money(metrics.collected)} />
        <Metric label="Cannot pay $50 now" value={metrics.unableNow} />
        <Metric label="Interested" value={metrics.interested} />
        <Metric label="No" value={metrics.no} />
        <Metric label="No response" value={metrics.missing} />
        <Metric label="Follow-up" value={metrics.followUp} />
      </section>

      {showVerbal ? <VerbalForm rows={data.rows} onSaved={async () => { setShowVerbal(false); setMessage("Verbal response and $50 deposit choice saved; login-help follow-up is now visible."); await load(); }} /> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.filters} aria-label="Filter and sort">
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student, ensemble, guardian, email" /></label>
        <label>Response<select value={responseFilter} onChange={(event) => setResponseFilter(event.target.value)}><option value="all">All responses</option><option value="serious_yes">Up to $2,000</option><option value="interested_limited">Needs a lower family cost</option><option value="no">No</option><option value="missing">No response</option></select></label>
        <label>Deposit<select value={depositFilter} onChange={(event) => setDepositFilter(event.target.value)}><option value="all">All deposits</option>{Object.entries(depositLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Follow-up<select value={followUpFilter} onChange={(event) => setFollowUpFilter(event.target.value)}><option value="all">All follow-up</option>{Object.entries(followUpLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Student name</option><option value="ensemble">Ensemble</option><option value="response">Response</option><option value="deposit">Deposit</option><option value="updated">Most recent</option></select></label>
      </section>

      <p className={styles.count}>Showing {rows.length} of {data.rows.length} students · Updated {displayDate(data.updatedAt)}</p>
      <div className={styles.tableWrap}>
        <table>
          <thead><tr><th>Student</th><th>Family response</th><th>$50 deposit</th><th>Contact and inputs</th><th>Staff follow-up</th></tr></thead>
          <tbody>{rows.map((row) => <TripRow row={row} key={row.student.id} onChanged={load} setMessage={setMessage} />)}</tbody>
        </table>
      </div>
    </main>
  );
}

function Metric({ label, value, note }) { return <article><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</article>; }

function TripRow({ row, onChanged, setMessage }) {
  const [eligibilityStatus, setEligibilityStatus] = useState(row.tracking.eligibility_status);
  const [followUpStatus, setFollowUpStatus] = useState(row.tracking.follow_up_status);
  const [staffNote, setStaffNote] = useState(row.tracking.staff_note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function saveTracking() {
    setBusy(true); setError("");
    const response = await fetch("/api/admin/carnegie-2027", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ studentId:row.student.id, eligibilityStatus, followUpStatus, staffNote }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error || "Could not save."); return; }
    setMessage(`Follow-up saved for ${row.student.display_name}.`); onChanged();
  }

  async function refund() {
    if (!window.confirm(`Refund the ${money(row.completedPayment.amount_cents)} PayPal deposit for ${row.student.display_name}? This sends a real processor refund and updates the ledger.`)) return;
    setBusy(true); setError("");
    const response = await fetch("/api/admin/carnegie-2027", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"refund", paymentId:row.completedPayment.id }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error || "Refund failed."); return; }
    setMessage(body.status === "pending" ? "PayPal accepted the refund and is still processing it." : `Refund completed for ${row.student.display_name}; the ledger is reconciled.`); onChanged();
  }

  const help = (row.submission?.help_options || []).map((value) => CARNEGIE_HELP_OPTIONS.find((option) => option.value === value)?.label || value);
  return <tr>
    <td><strong>{row.student.display_name}</strong><span>{row.student.ensemble_2026 || "No ensemble"} · Grade {row.student.grade_fall26 || "—"}</span><Link href={`/admin/billing?studentId=${encodeURIComponent(row.student.id)}`}>Open full ledger</Link></td>
    <td>{row.submission ? <><strong>{carnegieResponseLabel(row.submission.response, row.submission.agreement_version)}</strong><span>{sourceLabels[row.submission.source]} · {displayDate(row.submission.created_at)}</span>{row.submission.source === "staff_verbal" ? <em>Unsigned verbal record</em> : <em>Signed family response</em>}</> : <em>No response</em>}</td>
    <td><strong className={`${styles.status} ${styles[row.depositStatus]}`}>{depositLabels[row.depositStatus]}</strong>{row.completedPayment ? <><span>{money(row.completedPayment.amount_cents)} · {row.completedPayment.method}</span><span>{displayDate(row.completedPayment.received_at || row.completedPayment.created_at)}</span><button type="button" className={styles.danger} disabled={busy} onClick={refund}>Refund through PayPal</button></> : row.charge ? <span>{money(row.charge.amount_cents)} active ledger charge</span> : null}</td>
    <td><strong>{row.contact.name || "No guardian listed"}</strong><span>{row.contact.email || "No email"}</span><span>{row.contact.phone || "No phone"}</span>{row.submission ? <details><summary>All form inputs</summary><p><b>Agreement:</b> {row.submission.agreement_version}</p><p><b>Maximum:</b> {carnegieAmountBandLabel(row.submission.maximum_family_amount_band, row.submission.agreement_version) || "Not applicable"}</p><p><b>Deposit choice:</b> {carnegieDepositChoiceLabel(row.submission.deposit_choice, row.submission.agreement_version, row.submission.response)}</p><p><b>Help:</b> {help.join("; ") || "None selected"}</p><p><b>Guardian signature:</b> {row.submission.guardian_signature || "Verbal - not signed"}</p><p><b>Student signature:</b> {row.submission.student_signature || "Verbal - not signed"}</p>{row.submission.note ? <p><b>Submission note:</b> {row.submission.note}</p> : null}</details> : null}</td>
    <td><label>Eligibility<select value={eligibilityStatus} onChange={(event) => setEligibilityStatus(event.target.value)}>{Object.entries(eligibilityLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Follow-up<select value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value)}>{Object.entries(followUpLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Staff note<textarea value={staffNote} onChange={(event) => setStaffNote(event.target.value)} rows="2" /></label><button type="button" disabled={busy} onClick={saveTracking}>{busy ? "Saving…" : "Save follow-up"}</button>{error ? <small className={styles.inlineError}>{error}</small> : null}</td>
  </tr>;
}

function VerbalForm({ rows, onSaved }) {
  const [studentId, setStudentId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [response, setResponse] = useState("");
  const [maximumFamilyAmountBand, setMaximumFamilyAmountBand] = useState("");
  const [depositChoice, setDepositChoice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function selectStudent(value) {
    setStudentId(value); const row = rows.find((item) => item.student.id === value);
    setGuardianName(row?.contact.name || ""); setGuardianEmail(row?.contact.email || ""); setGuardianPhone(row?.contact.phone || "");
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const request = await fetch("/api/admin/carnegie-2027", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"verbal", studentId, guardianName, guardianEmail, guardianPhone, response, maximumFamilyAmountBand, depositChoice, note, helpOptions:[], submissionKey:window.crypto.randomUUID() }) });
    const body = await request.json().catch(() => ({})); setBusy(false);
    if (!request.ok) { setError(body.error || "Could not save the verbal commitment."); return; }
    onSaved();
  }
  return <form className={styles.verbal} onSubmit={submit}><div><p className={styles.eyebrow}>Fallback intake</p><h2>Record a verbal family response</h2><p>Every yes response includes a separate $50 conditional-deposit choice. Pay now creates the normal charge without marking it received; cannot pay now keeps the yes response and creates no charge. This record stays unsigned and is automatically queued for login help.</p></div><label>Student<select value={studentId} onChange={(event) => selectStudent(event.target.value)} required><option value="">Choose student</option>{rows.map((row) => <option key={row.student.id} value={row.student.id}>{row.student.display_name} · {row.student.ensemble_2026}</option>)}</select></label><label>Guardian name<input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} required /></label><label>Guardian email<input type="email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} /></label><label>Guardian phone<input value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></label><label>Response<select value={response} onChange={(event) => { const next = event.target.value; setResponse(next); if (next !== "interested_limited") setMaximumFamilyAmountBand(""); if (next === "no") setDepositChoice(""); }} required><option value="">Choose a response</option>{CARNEGIE_RESPONSE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>{response === "interested_limited" ? <label>Maximum family amount<select value={maximumFamilyAmountBand} onChange={(event) => setMaximumFamilyAmountBand(event.target.value)} required><option value="">Choose</option>{CARNEGIE_AMOUNT_BANDS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : null}{response && response !== "no" ? <label>$50 deposit choice<select value={depositChoice} onChange={(event) => setDepositChoice(event.target.value)} required><option value="">Choose</option>{CARNEGIE_DEPOSIT_CHOICES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : null}<label className={styles.wide}>Staff note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows="2" placeholder="How the commitment was received and best follow-up details" /></label>{error ? <p className={`${styles.error} ${styles.wide}`}>{error}</p> : null}<button className={styles.primary} type="submit" disabled={busy}>{busy ? "Saving…" : "Save verbal response"}</button></form>;
}
