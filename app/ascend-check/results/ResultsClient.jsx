"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import AscendResults from "../AscendResults";
import styles from "../results.module.css";

async function publicFetch(url) {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The self checks could not be loaded.");
  return body;
}

export default function ResultsClient() {
  return <main className={styles.page}>
    <PageHeader title="Ascend Self Check Results" lede="What students said about each cleaning zone, by rehearsal day." />
    <p className={styles.muted}><Link href="/ascend-check">Back to the self check</Link></p>
    <AscendResults fetcher={publicFetch} endpoint="/api/ascend-check" />
  </main>;
}
