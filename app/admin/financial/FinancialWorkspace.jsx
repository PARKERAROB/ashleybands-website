"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "./financial.module.css";

const money = (cents) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format((Number(cents) || 0) / 100);

const name = (student) => [student.legalLast, student.preferredFirst || student.legalFirst]
  .filter(Boolean).join(", ") || student.displayName;

function rankGrade(value) {
  const match = String(value || "").match(/\d{1,2}/);
  return match ? Number(match[0]) : 99;
}

export default function FinancialWorkspace(props) {
  return <StaffGate>{(session, signOut) => <LiveWorkspace {...props} session={session} signOut={signOut} />}</StaffGate>;
}

function LiveWorkspace({ session, signOut, initialView, initialStudentId, initialFilter }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState(initialView);
  const [studentId, setStudentId] = useState(initialStudentId);
  const [filter, setFilter] = useState(initialFilter || "all");
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [groupId, setGroupId] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/financial${studentId ? `?student=${encodeURIComponent(studentId)}` : ""}`, {
      headers: staffAuthHeaders(session), signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load financial records.");
      setData(body);
    }).catch((loadError) => {
      if (loadError.name !== "AbortError") setError(loadError.message);
    });
    return () => controller.abort();
  }, [session, studentId]);

  const groups = useMemo(() => {
    const byId = new Map();
    for (const student of data?.roster || []) for (const item of student.groups) byId.set(item.id, item.name);
    return [...byId].sort((left, right) => left[1].localeCompare(right[1]));
  }, [data]);
  const grades = useMemo(() => [...new Set((data?.roster || []).map((student) => student.grade).filter(Boolean))]
    .sort((left, right) => rankGrade(left) - rankGrade(right)), [data]);

  const selectedStudent = (data?.roster || []).find((student) => student.id === studentId) || null;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = (data?.roster || []).filter((student) => {
      if (studentId && student.id !== studentId) return false;
      if (term && ![name(student), student.displayName, student.grade, ...student.groups.map((item) => item.name)]
        .join(" ").toLowerCase().includes(term)) return false;
      if (grade && student.grade !== grade) return false;
      if (groupId && !student.groups.some((item) => item.id === groupId)) return false;
      if (category) {
        const source = view === "fees" ? student.fee.charges : student.campaign.charges;
        if (!source.some((row) => row.category === category)) return false;
      }
      if (view === "fees") {
        if (filter === "open" && student.fee.balanceCents <= 0) return false;
        if (filter === "paid" && !(student.fee.chargedCents > 0 && student.fee.balanceCents <= 0)) return false;
      } else {
        if (filter === "under100" && student.campaign.raisedCents >= 10_000) return false;
        if (filter === "missing" && student.campaign.goalCents > 0) return false;
        if (filter === "met" && !student.campaign.goalMet) return false;
      }
      return true;
    });
    return [...visible].sort((left, right) => {
      if (sort === "grade") return rankGrade(left.grade) - rankGrade(right.grade) || name(left).localeCompare(name(right));
      if (sort === "balance") return right.fee.balanceCents - left.fee.balanceCents || name(left).localeCompare(name(right));
      if (sort === "raised") return right.campaign.raisedCents - left.campaign.raisedCents || name(left).localeCompare(name(right));
      if (sort === "remaining") return right.campaign.remainingCents - left.campaign.remainingCents || name(left).localeCompare(name(right));
      return name(left).localeCompare(name(right));
    });
  }, [category, data, filter, grade, groupId, search, sort, studentId, view]);

  const totals = useMemo(() => rows.reduce((result, student) => {
    result.feeCharged += student.fee.chargedCents;
    result.feePaid += student.fee.paidCents;
    result.feeBalance += student.fee.balanceCents;
    result.goal += student.campaign.goalCents;
    result.raised += student.campaign.raisedCents;
    result.gifts += student.campaign.confirmedGiftCents;
    result.legacy += student.campaign.legacySponsorshipCreditCents;
    return result;
  }, { feeCharged: 0, feePaid: 0, feeBalance: 0, goal: 0, raised: 0, gifts: 0, legacy: 0 }), [rows]);

  function location(next = {}) {
    const values = { view, student: studentId, filter, ...next };
    const params = new URLSearchParams();
    if (values.view !== "fees") params.set("view", values.view);
    if (values.student) params.set("student", values.student);
    if (values.filter !== "all") params.set("filter", values.filter);
    window.history.replaceState(null, "", `/admin/financial${params.size ? `?${params}` : ""}`);
  }

  function chooseView(next) {
    setView(next); setFilter("all"); setCategory("");
    location({ view: next, filter: "all" });
  }

  function chooseStudent(next) {
    setStudentId(next); location({ student: next });
  }

  return (
    <main className={styles.page}>
      <header className={styles.appBar}>
        <div><strong>Ashley Bands</strong><span>Staff workspace</span></div>
        <nav><Link href="/admin">Command center</Link><Link href="/admin/students">Current students</Link><button onClick={signOut}>Sign out</button></nav>
      </header>

      <section className={styles.heading}>
        <div><p>Current operations</p><h1>Financial</h1><span>Program fees and campaign funding stay separate.</span></div>
        <div className={styles.viewSwitch}>
          <button className={view === "fees" ? styles.active : ""} onClick={() => chooseView("fees")}>Program fees</button>
          <button className={view === "campaign" ? styles.active : ""} onClick={() => chooseView("campaign")}>Campaign funding</button>
        </div>
      </section>

      <section className={styles.metrics}>
        {view === "fees" ? <>
          <Metric label="Actual fees charged" value={data && !error ? money(totals.feeCharged) : "—"} />
          <Metric label="Fee payments" value={data && !error ? money(totals.feePaid) : "—"} />
          <Metric label="Open fee balance" value={data && !error ? money(totals.feeBalance) : "—"} tone={data && totals.feeBalance > 0 ? "warn" : ""} />
        </> : <>
          <Metric label="Campaign goals" value={data && !error ? money(totals.goal) : "—"} />
          <Metric label="Raised" value={data && !error ? money(totals.raised) : "—"} />
          <Metric label="Confirmed gifts" value={data && !error ? money(totals.gifts) : "—"} />
        </>}
      </section>

      {totals.legacy && view === "campaign" ? <p className={styles.reconcileNotice}>{money(totals.legacy)} in older sponsorship credits is shown separately and is not double-counted until reconciled.</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {selectedStudent ? <section className={styles.scopeBar}>
        <div><span>Student context</span><strong>{selectedStudent.displayName}</strong><p>{selectedStudent.grade || "Grade not listed"}</p></div>
        <div><Link href={`/admin/students?student=${encodeURIComponent(selectedStudent.id)}`}>Open full student</Link><button onClick={() => chooseStudent("")}>Show full program</button></div>
      </section> : null}

      <div className={styles.workspace}>
        <aside className={styles.filters}>
          <strong>Find the answer</strong>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student or group" /></label>
          <label><span>Question</span><select value={filter} onChange={(event) => { setFilter(event.target.value); location({ filter: event.target.value }); }}>
            <option value="all">All current</option>
            {view === "fees" ? <><option value="open">Open fee balance</option><option value="paid">Fees paid</option></> : <><option value="under100">Raised under $100</option><option value="missing">Goal not set</option><option value="met">Goal met</option></>}
          </select></label>
          <label><span>Grade</span><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Group</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">All groups</option>{groups.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{(data?.categories || []).filter((item) => item.kind === (view === "fees" ? "fee" : "funding_goal")).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <button className={styles.clear} onClick={() => { setSearch(""); setFilter("all"); setGrade(""); setGroupId(""); setCategory(""); location({ filter: "all" }); }}>Clear filters</button>
        </aside>

        <section className={styles.results}>
          <header><div><strong>{view === "fees" ? "Program fee records" : "Campaign progress"}</strong><span>{error ? "Unavailable" : data ? `${rows.length} current students` : "Loading…"}</span></div><label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Last name</option><option value="grade">Grade</option>{view === "fees" ? <option value="balance">Fee balance</option> : <><option value="raised">Raised</option><option value="remaining">Remaining</option></>}</select></label></header>
          {!error ? <div className={styles.tableWrap}>
            <table><thead><tr><th>Student</th><th>Grade / groups</th>{view === "fees" ? <><th>Charged</th><th>Paid</th><th>Fee balance</th></> : <><th>Goal</th><th>Raised</th><th>Remaining</th></>}<th></th></tr></thead>
              <tbody>{rows.map((student) => <FinancialRow key={student.id} student={student} view={view} onOpen={() => chooseStudent(student.id)} />)}</tbody></table>
          </div> : <p className={styles.empty}>Financial records are unavailable right now.</p>}
          {!rows.length && data && !error ? <p className={styles.empty}>No current students match.</p> : null}
        </section>
      </div>

      {selectedStudent ? <StudentFinancialDetail student={selectedStudent} /> : null}
      <p className={styles.source}>Sources: fee charges and payments; confirmed sponsorship gifts; current program memberships. Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "when source records change"}.</p>
    </main>
  );
}

function Metric({ label, value, tone = "" }) {
  return <div className={tone ? styles[tone] : ""}><span>{label}</span><strong>{value}</strong></div>;
}

function FinancialRow({ student, view, onOpen }) {
  const record = view === "fees" ? student.fee : student.campaign;
  return <tr><td data-label="Student"><strong>{name(student)}</strong></td><td data-label="Grade / groups">{student.grade || "—"}<small>{student.groups.map((item) => item.name).join(" · ")}</small></td>{view === "fees" ? <><td data-label="Charged">{money(record.chargedCents)}</td><td data-label="Paid">{money(record.paidCents)}</td><td data-label="Fee balance"><b className={record.balanceCents > 0 ? styles.negative : ""}>{money(record.balanceCents)}</b></td></> : <><td data-label="Goal">{record.goalCents ? money(record.goalCents) : "Not set"}</td><td data-label="Raised"><b>{money(record.raisedCents)}</b><small>{record.confirmedGiftCents ? `${money(record.confirmedGiftCents)} confirmed gifts` : ""}</small></td><td data-label="Remaining">{record.goalCents ? money(record.remainingCents) : "—"}</td></>}<td><button className={styles.open} onClick={onOpen}>Open</button></td></tr>;
}

function StudentFinancialDetail({ student }) {
  return <section className={styles.detail}>
    <header><div><span>Student financial picture</span><h2>{student.displayName}</h2></div><Link href={`/admin/students?student=${encodeURIComponent(student.id)}`}>Full student →</Link></header>
    <div className={styles.detailGrid}>
      <article><h3>Program fees</h3><p><span>Charged</span><strong>{money(student.fee.chargedCents)}</strong></p><p><span>Paid</span><strong>{money(student.fee.paidCents)}</strong></p><p><span>Fee balance</span><strong>{money(student.fee.balanceCents)}</strong></p>{student.fee.charges.map((row) => <small key={row.id}>{row.label || row.category} · {money(row.amount_cents)}</small>)}<Link href={`/admin/billing?studentId=${encodeURIComponent(student.id)}`}>Manage fee ledger →</Link></article>
      <article><h3>Campaign funding</h3><p><span>Goal</span><strong>{student.campaign.goalCents ? money(student.campaign.goalCents) : "Not set"}</strong></p><p><span>Family contributions</span><strong>{money(student.campaign.familyContributionCents)}</strong></p><p><span>Confirmed gifts</span><strong>{money(student.campaign.confirmedGiftCents)}</strong></p><p><span>Progress</span><strong>{money(student.campaign.raisedCents)}</strong></p>{student.campaign.legacySponsorshipCreditCents ? <small>{money(student.campaign.legacySponsorshipCreditCents)} older sponsor credit awaiting reconciliation</small> : null}</article>
    </div>
  </section>;
}
