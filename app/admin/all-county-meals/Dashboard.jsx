"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { Button, DataTable, Notice, PageHeader, StatusChip } from "@/components/ui";
import { staffAuthHeaders } from "@/lib/staffSession";
import { formatCents } from "@/lib/allCountyMeals.mjs";
import styles from "./dashboard.module.css";

const CHIP = { invoiced: "waiting", paid: "done", partial: "needed", overpaid: "info" };

export default function Dashboard() {
  return <StaffGate>{(session, signOut) => <Orders session={session} signOut={signOut} />}</StaffGate>;
}

function Orders({ session, signOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/all-county-meals", { headers: staffAuthHeaders(session), cache: "no-store" });
      if (response.status === 401) return signOut();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setError(e.message || "Unable to load.");
    }
  }, [session, signOut]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function download() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/admin/all-county-meals?format=csv", { headers: staffAuthHeaders(session), cache: "no-store" });
      if (response.status === 401) return signOut();
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "all-county-meals-2026.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message || "Export unavailable.");
    } finally {
      setExporting(false);
    }
  }

  async function savePayment(id, payload) {
    const response = await fetch("/api/admin/all-county-meals", {
      method: "POST",
      headers: { ...staffAuthHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    if (response.status === 401) return signOut();
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "The payment could not be saved.");
    await load();
  }

  const meals = data ? data.meals.filter((meal) => meal.offered || data.mealTotals[meal.key] > 0) : [];

  return (
    <main className="narrow-page">
      <PageHeader title="All-County meal orders" lede="Director orders from /all-county/meals. Private: student names are minors from other schools." />
      {error ? <Notice tone="error" title={error} role="alert" /> : null}
      {!data && !error ? <p role="status">Loading orders…</p> : null}
      {data ? (
        <div className={styles.stack}>
          <section aria-labelledby="order-counts">
            <h2 id="order-counts" className={styles.h2}>Meals to order</h2>
            <ul className={styles.counts}>
              {meals.map((meal) => (
                <li key={meal.key}><span className={styles.count}>{data.mealTotals[meal.key]}</span> {meal.label}{meal.offered ? "" : " (no longer offered)"}</li>
              ))}
            </ul>
            <p className={styles.muted}>
              {data.totals.schools} {data.totals.schools === 1 ? "school" : "schools"}, {data.totals.students} students, {data.totals.meals} meals at {formatCents(data.priceCents)}.
              Invoiced {formatCents(data.totals.invoicedCents)}. Received {formatCents(data.totals.paidCents)}, including {formatCents(data.totals.onlineCents)} online (plus {formatCents(data.totals.surchargeCents)} in online fees).
              Deadline {new Date(data.deadline).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={load}>Refresh</Button>
              <Button variant="secondary" onClick={download} disabled={exporting}>{exporting ? "Preparing…" : "Download CSV"}</Button>
            </div>
          </section>

          <section aria-labelledby="by-school">
            <h2 id="by-school" className={styles.h2}>By school</h2>
            {data.schools.length === 0 ? <p>No orders yet.</p> : null}
            <div className={styles.stack}>
              {data.schools.map((school) => <School key={school.id} school={school} meals={meals} onSave={savePayment} />)}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function School({ school, meals, onSave }) {
  const [amount, setAmount] = useState(((school.paidCents ?? Math.max(school.totalCents - school.onlineCents, 0)) / 100).toFixed(2));
  const [method, setMethod] = useState(school.paidMethod || "check");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(payload) {
    setBusy(true);
    setError("");
    try { await onSave(school.id, payload); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const columns = [
    { key: "name", label: "Student", rowHeader: true },
    ...meals.map((meal) => ({ key: meal.key, label: meal.label })),
    { key: "amount", label: "Amount", align: "end" },
  ];
  const rows = school.students.map((line) => ({
    name: line.name,
    ...Object.fromEntries(meals.map((meal) => [meal.key, line.meals.includes(meal.key) ? "Yes" : ""])),
    amount: formatCents(line.amountCents),
  }));

  return (
    <article className={styles.school}>
      <header className={styles.schoolHead}>
        <h3>{school.school}</h3>
        <StatusChip status={CHIP[school.payment.status]}>{school.payment.label}</StatusChip>
      </header>
      <p className={styles.muted}>{school.director} · {school.email} · updated {new Date(school.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
      <p><strong>{meals.map((meal) => `${meal.label}: ${school.counts[meal.key]}`).join(" · ")}</strong></p>
      <p><strong>Invoice: {school.totalMeals} meals × {formatCents(school.priceCents)} = {formatCents(school.totalCents)}</strong>{school.paidCents != null ? ` · Check/cash ${formatCents(school.paidCents)} (${school.paidMethod})` : ""}{school.onlineCents ? ` · Paid online ${formatCents(school.onlineCents)} (+${formatCents(school.surchargeCents)} fee)` : ""}</p>
      <details>
        <summary className={styles.summary}>{school.students.length} {school.students.length === 1 ? "student" : "students"}</summary>
        <DataTable label={`${school.school} students`} columns={columns} rows={rows} rowKey="name" empty="No students on this order." />
      </details>
      <form className={styles.pay} onSubmit={(event) => { event.preventDefault(); save({ paid_cents: Math.round(Number(amount) * 100), paid_method: method }); }}>
        <label>Check/cash received <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" size={8} /></label>
        <label>Paid by <select value={method} onChange={(e) => setMethod(e.target.value)}><option value="check">Check</option><option value="cash">Cash</option><option value="mixed">Check and cash</option></select></label>
        <Button type="submit" variant="secondary" disabled={busy}>{school.paidCents != null ? "Update check/cash" : "Record check/cash"}</Button>
        {school.paidCents != null ? <Button type="button" variant="quiet" disabled={busy} onClick={() => save({ paid_cents: null })}>Clear check/cash</Button> : null}
      </form>
      {error ? <Notice tone="error" title={error} role="alert" /> : null}
    </article>
  );
}
