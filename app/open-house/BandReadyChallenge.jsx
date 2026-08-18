"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./open-house.module.css";

export default function BandReadyChallenge() {
  const router = useRouter();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/session")
      .then((response) => response.json().catch(() => ({ signedIn: false })))
      .then((data) => {
        if (cancelled) return;
        if (data?.signedIn) router.replace("/portal/band-ready");
        else setStatus("signed-out");
      })
      .catch(() => { if (!cancelled) setStatus("signed-out"); });
    return () => { cancelled = true; };
  }, [router]);

  if (status === "checking") return <section className={styles.welcome}><p>Opening Band Ready…</p></section>;

  return (
    <section className={styles.welcome}>
      <p className={styles.eyebrow}>Ashley Bands Open House</p>
      <h1>Get Band Ready.</h1>
      <p>Start by connecting to the Family Portal. Then complete six small stops for your student. Your progress will be saved, and you&apos;ll receive a personalized first-day checklist when you finish.</p>
      <div className={styles.welcomeActions}>
        <Link className={styles.primaryLink} href="/portal?next=/portal/band-ready">Sign in and start Band Ready</Link>
        <Link className={styles.secondaryLink} href="/portal/request?next=/portal/band-ready">New family email? Request access</Link>
      </div>
      <div className={styles.welcomeNote}>
        <strong>Already started?</strong>
        <span>Use the same family email on any phone or computer. Your student&apos;s progress will be waiting.</span>
      </div>
      <p className={styles.prizeLine}>Complete Band Ready and show the final screen for a sticker or candy prize.</p>
    </section>
  );
}
