#!/usr/bin/env node
/**
 * Sync-back: read the live sponsorship data from Supabase and write a generated
 * status view into BandsofAHS, so the private Area reflects raised-vs-goal without
 * anyone querying the database. BandsofAHS stays the source of truth for everything
 * else; this file is a read-only mirror of the live numbers.
 *
 * Run on demand (e.g. from /start or a weekly review):
 *   node scripts/export-sponsorship-status.mjs
 *   node scripts/export-sponsorship-status.mjs --dry-run   # print, don't write
 *
 * Output: <BandsofAHS>/projects/marching-band/sponsorship-packet-2026-2027/sponsorship-status.md
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { bandsofAHSRoot, loadBandWebsiteEnv } from "./lib/workspace-paths.mjs";

loadBandWebsiteEnv();

const DRY_RUN = process.argv.includes("--dry-run");
const OUT_PATH = join(
  bandsofAHSRoot,
  "projects/marching-band/sponsorship-packet-2026-2027/sponsorship-status.md"
);
const GOAL = Number(process.env.SPONSORSHIP_GOAL || 35000); // ~$500 x ~70 students

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}
const headers = { apikey: secret, Authorization: `Bearer ${secret}` };

async function getAll(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function money(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

async function main() {
  const [families, prospects, businesses, outreach] = await Promise.all([
    getAll("families?select=id,display_name"),
    getAll("prospects?select=*,business:businesses(name_display)"),
    getAll("businesses?select=id,outreach_status"),
    getAll("business_outreach?select=send_status,reply_classification")
  ]);

  const byStatus = (rows, field) =>
    rows.reduce((acc, r) => ((acc[r[field]] = (acc[r[field]] || 0) + 1), acc), {});

  const pStatus = byStatus(prospects, "status");
  const reported = prospects
    .filter((p) => p.status === "yes")
    .reduce((s, p) => s + (Number(p.committed_amount) || 0), 0);
  const confirmed = prospects
    .filter((p) => p.status === "yes" && p.confirmed_by_lead)
    .reduce((s, p) => s + (Number(p.committed_amount) || 0), 0);

  const bizStatus = byStatus(businesses, "outreach_status");
  const sendStatus = byStatus(outreach, "send_status");

  const commits = prospects
    .filter((p) => p.status === "yes" && p.committed_amount)
    .sort((a, b) => Number(b.committed_amount) - Number(a.committed_amount))
    .map(
      (p) =>
        `- ${p.business?.name_display || "?"} — ${money(p.committed_amount)}` +
        `${p.committed_tier ? ` (${p.committed_tier})` : ""}` +
        `${p.confirmed_by_lead ? " ✓ confirmed" : " (reported, unconfirmed)"}`
    );

  const pct = GOAL ? Math.round((confirmed / GOAL) * 100) : 0;
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  const md = `# Sponsorship status (live)

> GENERATED from Supabase by \`band-website/scripts/export-sponsorship-status.mjs\`.
> Do not edit by hand. Last synced: ${now}.

## Toward the goal
- Goal: ${money(GOAL)} (~$500 x ~70 students, collective program goal)
- Raised (confirmed): ${money(confirmed)} (${pct}% of goal)
- Reported, not yet confirmed: ${money(reported - confirmed)}
- Families participating: ${families.length}

## Warm path (family tracker)
- Prospects total: ${prospects.length}
- Yes: ${pStatus.yes || 0} · Pending: ${pStatus.pending || 0} · No: ${pStatus.no || 0} · Ask later: ${pStatus.later || 0}

## Cold path (681-business prospect DB)
- Businesses by outreach status: ${
    Object.entries(bizStatus)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ") || "none"
  }
- Cold sends by status: ${
    Object.entries(sendStatus)
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ") || "none queued/sent"
  }

## Commitments
${commits.length ? commits.join("\n") : "_None yet._"}
`;

  if (DRY_RUN) {
    console.log(md);
    return;
  }
  writeFileSync(OUT_PATH, md);
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
