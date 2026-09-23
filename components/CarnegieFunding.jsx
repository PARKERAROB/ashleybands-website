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
  // Measure against the near goal until it is met; the full trip figure is an estimate.
  const target = reached ? goal : milestone;
  return (
    <section className={styles.funding} aria-label="Carnegie funding progress">
      <p className={styles.kicker}>Get the kids to Carnegie</p>
      <div className={styles.headline} aria-live="polite">
        <strong>{net == null ? (unavailable ? "Total temporarily unavailable" : "Checking funds received…") : dollars(net)}</strong>
        <span>{net == null ? `First goal: ${dollars(target)}` : `raised toward ${reached ? "the full trip goal" : "our first goal"} of ${dollars(target)}`}</span>
      </div>
      <div className={styles.track} role="progressbar" aria-label={reached ? "Carnegie funding toward the full trip goal" : "Carnegie funding toward the first goal"} aria-valuemin={0} aria-valuemax={target}
        {...(net != null ? { "aria-valuenow": Math.min(target, Math.max(0, net)), "aria-valuetext": `${dollars(net)} raised toward ${dollars(target)}` } : {})}>
        {net != null && <div className={styles.fill} style={{ width: `${Math.min(100, Math.max(0, net / target * 100))}%` }} />}
      </div>
      <p className={styles.milestone}>
        {net != null && <strong>{reached ? `First goal of ${dollars(milestone)} reached. Thank you.` : `${dollars(Math.max(0, milestone - net))} to go`}</strong>}
        <span>Every gift lowers the cost for every student who goes.</span>
      </p>
      <p className={styles.note}>Includes received family payments, donations and sponsorships designated for Carnegie, after payment fees and refunds.{reached ? "" : ` The full trip goal is an estimated ${dollars(goal)} and will be updated when final prices are known.`}</p>
      {funding && <p className={styles.updated}>Automatically updated · Checked {new Date(funding.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</p>}
    </section>
  );
}
