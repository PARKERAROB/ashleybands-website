"use client";

import { useEffect, useState } from "react";
import { CARNEGIE_FUNDING_GOAL_CENTS, CARNEGIE_FIRST_MILESTONE_CENTS } from "@/lib/carnegieFunding.mjs";
import styles from "./CarnegieFunding.module.css";

const dollars = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export default function CarnegieFunding() {
  const [funding, setFunding] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/carnegie-2027/funding", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        if (active) { setFunding(data); setUnavailable(false); }
      } catch {
        if (active) { setFunding(null); setUnavailable(true); }
      }
    }
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, []);
  const net = funding?.netCents;
  const milestone = funding?.milestoneCents || CARNEGIE_FIRST_MILESTONE_CENTS;
  const goal = funding?.goalCents || CARNEGIE_FUNDING_GOAL_CENTS;
  const reached = net != null && net >= milestone;
  return (
    <section className={styles.funding} aria-label="Carnegie funding progress">
      <p className={styles.kicker}>Get the kids to Carnegie</p>
      <div className={styles.headline} aria-live="polite">
        <strong>{net == null ? (unavailable ? "Total temporarily unavailable" : "Checking funds received…") : dollars(net)}</strong>
        <span>net funds received · {dollars(goal)} total goal</span>
      </div>
      <div className={styles.track} role="progressbar" aria-label="Total Carnegie funding" aria-valuemin={0} aria-valuemax={goal}
        {...(net != null ? { "aria-valuenow": Math.min(goal, Math.max(0, net)), "aria-valuetext": `${dollars(net)} net received toward ${dollars(goal)}` } : {})}>
        {net != null && <div className={styles.fill} style={{ width: `${Math.min(100, Math.max(0, net / goal * 100))}%` }} />}
        <span className={styles.marker} style={{ left: `${milestone / goal * 100}%` }} />
      </div>
      <p className={styles.milestone}><strong>{reached ? "First major goal reached" : "First major goal"}: {dollars(milestone)}</strong>
        {net != null && <span>{reached ? "Onward to the full trip goal." : `${dollars(Math.max(0, milestone - net))} to go`}</span>}
      </p>
      <p className={styles.note}>Includes received family payments, donations and sponsorships designated for Carnegie, after payment fees and refunds.</p>
      {funding && <p className={styles.updated}>Automatically updated · Checked {new Date(funding.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</p>}
    </section>
  );
}
