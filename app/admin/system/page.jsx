"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffGate } from "@/components/StaffGate";
import { staffAuthHeaders } from "@/lib/staffSession";
import styles from "./system.module.css";

const ROLE_OPTIONS = [
  { value: "director", label: "Director" },
  { value: "program_staff", label: "Program staff" },
  { value: "sponsor_lead", label: "Sponsorship lead" },
  { value: "booster_treasurer", label: "Booster treasurer" },
  { value: "event_worker", label: "Event worker" },
];
const LIMITED_CAPABILITIES = {
  booster_treasurer: [
    { value: "funding.read", label: "View fundraising", scopes: ["global"] },
    { value: "billing.read", label: "View billing", scopes: ["student", "global"] },
    { value: "billing.write", label: "Record billing", scopes: ["student", "global"] },
    { value: "billing.export", label: "Export billing", scopes: ["global"] },
  ],
  event_worker: [
    { value: "attendance.events.read", label: "View event attendance", scopes: ["attendance_event"] },
    { value: "attendance.events.write", label: "Take event attendance", scopes: ["attendance_event"] },
    { value: "attendance.staff.write", label: "Record staff attendance", scopes: ["attendance_event"] },
  ],
};

const SCOPE_LABELS = {
  global: "All records in this function",
  student: "One current student",
  attendance_event: "One attendance event",
};

function dateTime(value) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not recorded";
}

function ageHours(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? (Date.now() - timestamp) / 3_600_000 : Infinity;
}

function roleLabel(value) {
  return ROLE_OPTIONS.find((role) => role.value === value)?.label || value.replaceAll("_", " ");
}

function backupState(backup) {
  if (!backup) return { state: "warn", label: "Not recorded" };
  if (backup.status !== "complete") return { state: "warn", label: backup.status || "Incomplete" };
  if (ageHours(backup.completed_at) > 26) return { state: "warn", label: "Stale" };
  return { state: "good", label: "Fresh" };
}

function recoveryState(backup, verification) {
  if (!backup) return { state: "warn", label: "Waiting for a backup", tied: false, typed: false };
  const tied = Boolean(verification
    && verification.backup_run_id === backup.id
    && verification.manifest_sha256
    && verification.manifest_sha256 === backup.manifest_sha256);
  if (!tied) return { state: "warn", label: "Not checked for latest backup", tied: false, typed: false };
  if (verification.status !== "passed") return { state: "warn", label: verification.status || "Incomplete", tied: true, typed: false };
  const typed = verification.target_label === "isolated_pglite_exact_migrations";
  return typed
    ? { state: "good", label: "Typed restore verified", tied: true, typed: true }
    : { state: "info", label: "Integrity verified", tied: true, typed: false };
}

export default function SystemPage() {
  return <StaffGate>{(session) => <SystemWorkspace session={session} />}</StaffGate>;
}

function SystemWorkspace({ session }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/system", { headers: staffAuthHeaders(session), cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "System oversight could not be loaded.");
    setData(body);
  }, [session]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/system", { headers: staffAuthHeaders(session), cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "System oversight could not be loaded.");
        if (active) setData(body);
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [session]);

  async function changeAccess(payload) {
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/system", {
        method: "POST",
        headers: { ...staffAuthHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The access change was not completed.");
      setNotice("Access updated and recorded in the audit trail.");
      await load();
      return true;
    } catch (changeError) {
      setNotice(changeError.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function retryLoad() {
    setData(null);
    try {
      await load();
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  const latestBackup = data?.backups?.[0] || null;
  const latestRestore = latestBackup ? (data?.restores || []).find((verification) => verification.backup_run_id === latestBackup.id
    && verification.manifest_sha256
    && verification.manifest_sha256 === latestBackup.manifest_sha256) || null : null;
  const latestAudit = data?.audit?.[0] || null;
  const backupHealth = backupState(latestBackup);
  const recoveryHealth = recoveryState(latestBackup, latestRestore);
  const auditIsRecent = latestAudit && ageHours(latestAudit.occurred_at) <= 24;
  const activeScopes = useMemo(() => (data?.scopes || []).filter((scope) => !scope.ends_at), [data]);

  return <main className={styles.page}>
    <header className={styles.header}><div><p>Protected system controls</p><h1>Audit, recovery & staff access</h1></div><Link href="/admin">Command center</Link></header>
    <p className={styles.intro}>This page shows whether sensitive work is attributable, recoverable, and limited to the right staff account.</p>
    {error ? <div className={styles.alert} role="alert"><span>{error}</span><button type="button" onClick={retryLoad}>Retry</button></div> : null}
    {notice ? <p className={styles.notice} aria-live="polite">{notice}</p> : null}
    {!data && !error ? <p>Loading current system evidence…</p> : null}

    {data ? <>
      <section className={styles.healthGrid} aria-label="Recovery health">
        <article data-state={backupHealth.state}><span>Latest private backup</span><strong>{backupHealth.label}</strong><small>{latestBackup ? `${latestBackup.object_count} tables · ${latestBackup.row_count} rows · ${dateTime(latestBackup.completed_at)}` : "No completed backup is recorded."}</small></article>
        <article data-state={recoveryHealth.state}><span>Latest recovery check</span><strong>{recoveryHealth.label}</strong><small>{recoveryHealth.tied && latestRestore ? `${latestRestore.verified_object_count} tables · ${latestRestore.verified_row_count} rows · ${dateTime(latestRestore.completed_at)}. ${recoveryHealth.typed ? "Exact migrations and typed records restored in an isolated database." : "Checksums and JSON replay verified; a typed restore is not recorded."}` : "The latest backup does not have a matching integrity check."}</small></article>
        <article data-state={auditIsRecent ? "good" : "info"}><span>Audit trail</span><strong>{latestAudit ? (auditIsRecent ? "Recent activity" : "No recent activity") : "No evidence"}</strong><small>{latestAudit ? `Latest attributed action · ${dateTime(latestAudit.occurred_at)}` : "No attributed action is visible."}</small></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><p>Access</p><h2>Staff accounts</h2></div><span>No PINs or session tokens are shown here.</span></div>
        <div className={styles.staffGrid}>{data.staff.map((account) => <StaffCard key={`${account.id}:${account.role}:${account.disabled_at || "active"}`} account={account} viewerId={data.viewerId} scopes={activeScopes.filter((scope) => scope.staff_id === account.id)} scopeOptions={data.scopeOptions || {}} busy={busy} onChange={changeAccess} />)}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><p>Evidence</p><h2>Recent attributed activity</h2></div><Link href="/admin/data-inventory">Source & data inventory</Link></div>
        <div className={styles.auditList}>{data.audit.slice(0, 30).map((entry) => <div key={entry.id}><span>{dateTime(entry.occurred_at)}</span><strong>{entry.actor_name || entry.actor_type}</strong><span>{entry.action.replaceAll("_", " ")}</span><small>{entry.table_name}</small></div>)}</div>
      </section>
    </> : null}
  </main>;
}

function StaffCard({ account, viewerId, scopes, scopeOptions, busy, onChange }) {
  const [role, setRole] = useState(account.role);
  const [reason, setReason] = useState("");
  const capabilityOptions = LIMITED_CAPABILITIES[account.role] || [];
  const [capability, setCapability] = useState("");
  const selectedCapability = capabilityOptions.find((item) => item.value === capability) || null;
  const availableScopes = selectedCapability?.scopes || [];
  const [scopeType, setScopeType] = useState("");
  const [scopeRef, setScopeRef] = useState("");
  const active = !account.disabled_at;

  function scopeName(type, reference) {
    if (type === "global") return SCOPE_LABELS.global;
    return scopeOptions[type]?.find((option) => option.value === reference)?.label || "Recorded item no longer available";
  }

  async function apply(payload, confirmation) {
    if (!reason.trim()) return;
    if (!window.confirm(confirmation)) return;
    const changed = await onChange({ targetStaffId: account.id, reason, ...payload });
    if (changed) setReason("");
  }

  function chooseCapability(nextCapability) {
    const config = capabilityOptions.find((item) => item.value === nextCapability);
    const nextScope = config?.scopes?.[0] || "";
    setCapability(nextCapability);
    setScopeType(nextScope);
    setScopeRef("");
  }

  const chosenScopeLabel = scopeType === "global" ? SCOPE_LABELS.global : scopeName(scopeType, scopeRef);
  return <article className={styles.staffCard}>
    <div className={styles.identity}><div><strong>{account.display_name}</strong><span>{account.email}</span></div><b data-active={active}>{active ? "Active" : "Disabled"}</b></div>
    <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)} disabled={!active || account.id === viewerId || busy}>{ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    <label><span>Reason for the next change</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit trail" /></label>
    <div className={styles.actionRow}>
      {active ? <><button disabled={busy || !reason.trim() || role === account.role || account.id === viewerId} onClick={() => apply({ action: "change_role", role }, `Change ${account.display_name} from ${roleLabel(account.role)} to ${roleLabel(role)}?`)}>Change role</button><button className={styles.danger} disabled={busy || !reason.trim() || account.id === viewerId} onClick={() => apply({ action: "disable" }, `Disable ${account.display_name} and end their active sessions?`)}>Disable &amp; sign out</button></> : <button disabled={busy || !reason.trim()} onClick={() => apply({ action: "enable" }, `Enable ${account.display_name} as ${roleLabel(account.role)}?`)}>Enable account</button>}
    </div>
    <div className={styles.scopes}><strong>Active limited-role access</strong>{scopes.length ? scopes.map((scope) => <div key={scope.id}><span><b>{capabilityOptions.find((item) => item.value === scope.capability)?.label || scope.capability}</b><small>{scopeName(scope.scope_type, scope.scope_ref)}</small></span><button disabled={busy || !reason.trim()} onClick={() => apply({ action: "end_scope", capability: scope.capability, scopeType: scope.scope_type, scopeRef: scope.scope_ref }, `End ${scope.capability} access to ${scopeName(scope.scope_type, scope.scope_ref)} for ${account.display_name}?`)}>End</button></div>) : <small>No active scope assignments.</small>}</div>
    {capabilityOptions.length ? <details><summary>Grant limited-role access</summary><label><span>Permission</span><select value={capability} onChange={(event) => chooseCapability(event.target.value)}><option value="">Choose permission</option>{capabilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{capability ? <label><span>Applies to</span><select value={scopeType} onChange={(event) => { setScopeType(event.target.value); setScopeRef(""); }}>{availableScopes.map((item) => <option key={item} value={item}>{SCOPE_LABELS[item]}</option>)}</select></label> : null}{scopeType && scopeType !== "global" ? <label><span>{SCOPE_LABELS[scopeType]}</span><select value={scopeRef} onChange={(event) => setScopeRef(event.target.value)}><option value="">Choose one</option>{(scopeOptions[scopeType] || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}{scopeType === "global" ? <p className={styles.scopeWarning}>This grants access to every record in this function.</p> : null}<button disabled={busy || !active || !reason.trim() || !capability || !scopeType || (scopeType !== "global" && !scopeRef.trim())} onClick={() => apply({ action: "grant_scope", capability, scopeType, scopeRef }, `Grant ${selectedCapability?.label || capability} for ${chosenScopeLabel} to ${account.display_name}?`)}>Grant access</button></details> : null}
  </article>;
}
