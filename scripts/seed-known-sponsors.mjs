#!/usr/bin/env node
/**
 * Seed prior/known sponsors into businesses table with correct flags.
 * - Bill Clark Homes, Mulligan Foundation -> already-sponsor (do not cold-email)
 * - Seaside Bagels, Jeff Rifkin Portraits, Berkshire Hathaway, Carolina Beach
 *   Firefighters Association, Sheetz, U-Haul -> prior_sponsor=true,
 *   outreach_status='untested' (these are re-ask candidates)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const base = `${url}/rest/v1/businesses`;
const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

const canon = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

const KNOWN = [
  // Already-sponsor: do NOT cold-email. Re-engage personally.
  {
    name_display: "Bill Clark Homes",
    contact_person: "Kevin Boyette",
    notes: "Father of band student. $2,000 unsolicited gift 2024-08-01. Direct re-ask, not cold.",
    outreach_status: "already-sponsor",
    prior_sponsor: true,
    source: "manual:bdos-history"
  },
  {
    name_display: "Mulligan Foundation",
    notes: "$15,000 capital anchor Dec 2024 (instruments). Re-ask handled personally by Mr. Parker.",
    outreach_status: "already-sponsor",
    prior_sponsor: true,
    source: "manual:bdos-history"
  },
  // Prior sponsors per old hub-page list — confirmed by Mr. Parker as not current,
  // wants to re-ask. Flag prior_sponsor=true so we know history; status='untested'
  // so they go through the cold-willingness ask (with a tweaked greeting).
  { name_display: "Seaside Bagels", prior_sponsor: true, outreach_status: "untested", source: "manual:hub-prior", zone: "carolina-beach" },
  { name_display: "Jeff Rifkin Portraits", prior_sponsor: true, outreach_status: "untested", source: "manual:hub-prior" },
  { name_display: "Berkshire Hathaway", prior_sponsor: true, outreach_status: "untested", source: "manual:hub-prior", notes: "Re-ask candidate from prior years" },
  { name_display: "Carolina Beach Firefighters Association", prior_sponsor: true, outreach_status: "untested", source: "manual:hub-prior", zone: "carolina-beach" },
  { name_display: "Sheetz", prior_sponsor: true, outreach_status: "untested", source: "manual:hub-prior", notes: "Note: also a national chain — was a prior sponsor; re-ask via existing relationship channel" },
  { name_display: "U-Haul", prior_sponsor: true, outreach_status: "untested", source: "manual:hub-prior", notes: "Re-ask candidate from prior years" }
];

let inserted = 0, updated = 0;
for (const r of KNOWN) {
  r.name_canonical = canon(r.name_display);
  const lookup = await fetch(
    `${base}?name_canonical=eq.${encodeURIComponent(r.name_canonical)}&select=id`,
    { headers }
  );
  const existing = await lookup.json();
  if (Array.isArray(existing) && existing.length > 0) {
    const id = existing[0].id;
    const res = await fetch(`${base}?id=eq.${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(r)
    });
    if (!res.ok) console.error("update fail", r.name_display, await res.text());
    else { updated++; console.log(`updated: ${r.name_display}`); }
  } else {
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(r) });
    if (!res.ok) console.error("insert fail", r.name_display, await res.text());
    else { inserted++; console.log(`inserted: ${r.name_display}`); }
  }
}
console.log(`\ninserted=${inserted} updated=${updated}`);
