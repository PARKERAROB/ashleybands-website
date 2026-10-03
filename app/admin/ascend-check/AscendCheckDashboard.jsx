"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffGate } from "@/components/StaffGate";
import { Button, Field, Notice, PageHeader } from "@/components/ui";
import { staffAuthHeaders } from "@/lib/staffSession";
import AscendResults from "@/app/ascend-check/AscendResults";
import styles from "@/app/ascend-check/results.module.css";

export default function AscendCheckDashboard() {
  return <StaffGate>{(session, signOut) => <Dashboard session={session} signOut={signOut} />}</StaffGate>;
}

function Dashboard({ session, signOut }) {
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState(null);
  const [codeState, setCodeState] = useState("");

  const call = useCallback(async (url, init = {}) => {
    const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...staffAuthHeaders(session) } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      await signOut();
      return null;
    }
    if (!response.ok) throw new Error(body.error || "That did not work. Try again.");
    return body;
  }, [session, signOut]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      call("/api/admin/ascend-check").then((body) => {
        if (!body) return;
        setSavedCode(body.code);
        setCode((current) => current || body.code);
      }).catch((error) => setCodeState(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [call]);

  async function saveCode(event) {
    event.preventDefault();
    setCodeState("saving");
    try {
      const body = await call("/api/admin/ascend-check", { method: "PUT", body: JSON.stringify({ code }) });
      if (!body) return;
      setCode(body.code);
      setSavedCode(body.code);
      setCodeState("saved");
    } catch (saveError) {
      setCodeState(saveError.message);
    }
  }

  return <main className={styles.page}>
    <PageHeader title="Ascend Self Checks" lede="What students say about each cleaning zone. Compare it with your own flags." />
    <p className={styles.muted}>Anyone can see these results at <Link href="/ascend-check/results">ashleybands.com/ascend-check/results</Link>. Only this page shows or changes the code.</p>

    <section className={styles.panel} aria-labelledby="code-heading">
      <h2 id="code-heading">Rehearsal code</h2>
      <p className={styles.muted}>Students type this before they send. Change it any time. The old code stops working right away.</p>
      <form className={styles.row} onSubmit={saveCode}>
        <Field label="Code">
          <input value={code} onChange={(e) => { setCode(e.target.value); setCodeState(""); }} minLength={3} maxLength={40} autoComplete="off" className={styles.input} />
        </Field>
        <Button type="submit" variant="secondary" disabled={codeState === "saving"}>{codeState === "saving" ? "Saving…" : "Save code"}</Button>
      </form>
      {codeState === "saved" ? <p className={styles.ok}>Saved. Students now use {savedCode}.</p> : null}
      {codeState && !["saved", "saving"].includes(codeState) ? <p className={styles.bad} role="alert">{codeState}</p> : null}
      {savedCode === "" ? <Notice tone="deadline" title="No code is set yet.">Students cannot send until you save one.</Notice> : null}
    </section>

    <AscendResults fetcher={call} endpoint="/api/admin/ascend-check" />
  </main>;
}
