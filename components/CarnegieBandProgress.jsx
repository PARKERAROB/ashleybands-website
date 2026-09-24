"use client";

import { useEffect, useState } from "react";
import { CARNEGIE_FIRST_MILESTONE_CENTS, CARNEGIE_FUNDING_GOAL_CENTS } from "@/lib/carnegieFunding.mjs";
import styles from "./CarnegieBandProgress.module.css";

const dollars = (cents) => `$${Math.round((Number(cents) || 0) / 100).toLocaleString("en-US")}`;

// Compact band-wide Carnegie progress (#106), from the same public net total as the Carnegie page.
export default function CarnegieBandProgress({ children = null }) {
  const [funding, setFunding] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/carnegie-2027/funding", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unavailable"))))
      .then((data) => setFunding(data))
      .catch(() => setUnavailable(true));
    return () => controller.abort();
  }, []);
  const net = funding?.netCents;
  const milestone = funding?.milestoneCents || CARNEGIE_FIRST_MILESTONE_CENTS;
  const goal = funding?.goalCents || CARNEGIE_FUNDING_GOAL_CENTS;
  const target = net != null && net >= milestone ? goal : milestone;
  const pct = net == null ? 0 : Math.min(100, Math.max(0, (net / target) * 100));
  return (
    <section className={styles.band} aria-label="The whole band's Carnegie progress">
      <div className={styles.head}>
        <strong>The whole band</strong>
        <span>{net == null ? (unavailable ? "Total temporarily unavailable" : "Checking…") : `${dollars(net)} toward the ${dollars(target)} ${target === milestone ? "first goal" : "trip goal"}`}</span>
      </div>
      <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={target} {...(net != null ? { "aria-valuenow": Math.min(target, Math.max(0, net)) } : {})}>
        {net != null ? <div className={styles.fill} style={{ width: `${pct}%` }} /> : null}
      </div>
      {children}
    </section>
  );
}
