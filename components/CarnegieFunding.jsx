"use client";

import { useEffect, useState } from "react";
import { CARNEGIE_NEXT_GOAL_BY, CARNEGIE_NEXT_GOAL_CENTS } from "@/lib/carnegieFunding.mjs";
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
  // One number for the whole trip, measured against the next goal, not the full-trip estimate (#240).
  const target = funding?.milestoneCents || CARNEGIE_NEXT_GOAL_CENTS;
  const reached = net != null && net >= target;
  return (
    <section className={styles.funding} aria-label="Carnegie funding progress">
      <p className={styles.kicker}>Get the kids to Carnegie</p>
      <div className={styles.headline} aria-live="polite">
        <strong>{net == null ? (unavailable ? "Total temporarily unavailable" : "Checking funds received…") : dollars(net)}</strong>
        <span>{net == null ? `Next goal: ${dollars(target)} by ${CARNEGIE_NEXT_GOAL_BY}` : `raised for the trip so far. Next goal: ${dollars(target)} by ${CARNEGIE_NEXT_GOAL_BY}.`}</span>
      </div>
      <div className={styles.track} role="progressbar" aria-label="Carnegie funding toward the next goal" aria-valuemin={0} aria-valuemax={target}
        {...(net != null ? { "aria-valuenow": Math.min(target, Math.max(0, net)), "aria-valuetext": `${dollars(net)} raised toward ${dollars(target)}` } : {})}>
        {net != null && <div className={styles.fill} style={{ width: `${Math.min(100, Math.max(0, net / target * 100))}%` }} />}
      </div>
      <p className={styles.milestone}>
        {net != null && <strong>{reached ? `${dollars(target)} goal reached. Thank you.` : `${dollars(Math.max(0, target - net))} to go by ${CARNEGIE_NEXT_GOAL_BY}`}</strong>}
        <span>Every gift lowers the cost for every student who goes.</span>
      </p>
      <p className={styles.note}>This is the total raised for the trip so far: family payments, donations and sponsorships for Carnegie, all together, after payment fees and refunds. {dollars(target)} is what our {CARNEGIE_NEXT_GOAL_BY} trip payment needs. Our goal is to raise the full cost of the trip.</p>
      {funding && <p className={styles.updated}>Automatically updated · Checked {new Date(funding.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</p>}
    </section>
  );
}
