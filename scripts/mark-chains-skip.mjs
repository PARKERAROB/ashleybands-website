#!/usr/bin/env node
/**
 * Mark national-chain / non-local-prospect businesses as outreach_status='skip'
 * so they drop out of the cold-email pool. Cold-emailing a corporate
 * store-locator is pointless for a local HS band. Reversible (just a status).
 * Same chain detection used by enrich-contacts-firecrawl.mjs.
 *
 * Usage: node scripts/mark-chains-skip.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
const DRY = process.argv.includes("--dry-run");
const ENV = "/Users/parkerarob/Desktop/Band/band-website/.env.local";
for (const line of readFileSync(ENV, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY;
const base = `${url}/rest/v1/businesses`;
const H = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

const CHAIN = [
  /^(target|walmart|wal-mart|home depot|lowe'?s|sam'?s club|costco|bj'?s|big lots|aldi|food lion|harris teeter|publix|trader joe)/i,
  /^(mcdonald'?s|burger king|wendy'?s|taco bell|kfc|chick-?fil-?a|popeyes|sonic|hardee'?s|arby'?s|bojangles|cook ?out|checkers|rally'?s|zaxby'?s|cookout|five guys|culver'?s|whataburger|raising cane)/i,
  /^(subway|jimmy john'?s|jersey mike'?s|firehouse subs|panera|chipotle|qdoba|moe'?s|einstein|jason'?s deli)/i,
  /^(starbucks|dunkin|krispy kreme|tim hortons|biscuitville)/i,
  /^(domino'?s|pizza hut|papa john'?s|little caesars|papa murphy'?s|marco'?s pizza)/i,
  /^(applebee'?s|chili'?s|outback|olive garden|red lobster|ihop|denny'?s|cracker barrel|texas roadhouse|longhorn|ruby tuesday|golden corral|waffle house)/i,
  /^(cvs|walgreens|rite aid|duane reade)/i,
  /^(bank of america|wells fargo|chase|truist|bb&t|suntrust|pnc|td bank|citibank|capital one|us bank|first citizens|state employees'? credit)/i,
  /^(shell|exxon|bp|chevron|mobil|valero|sunoco|7-?eleven|circle k|wawa|sheetz|speedway|marathon|citgo|kangaroo)/i,
  /^(family dollar|dollar general|dollar tree|five below)/i,
  /^(at&t|verizon|t-mobile|sprint|xfinity|spectrum|metropcs|boost mobile|cricket)/i,
  /^(advance auto|autozone|o'?reilly|napa auto|pep boys|firestone|midas|jiffy lube|valvoline|meineke|take 5)/i,
  /^(aaa |american automobile)/i,
  /^(planet fitness|anytime fitness|crunch fitness|orangetheory|ymca|gold'?s gym)/i,
  /^(great clips|supercuts|sport clips|fantastic sams)/i,
  /^(enterprise|hertz|avis|budget|u-?haul|penske)/i,
  /^(murphy usa|murphy express|books-a-million)/i,
];
// Strip a leading "The " so "The Home Depot" still matches a "^home depot" rule.
const isChain = (n) => { const s = String(n || "").replace(/^the\s+/i, ""); return CHAIN.some((r) => r.test(s)); };

const rows = await (await fetch(`${base}?select=id,name_display,outreach_status,prior_sponsor`, { headers: H })).json();
const targets = rows.filter((r) => isChain(r.name_display) && r.outreach_status === "untested" && !r.prior_sponsor);
console.log(`chains to skip: ${targets.length}`);
let n = 0;
for (const r of targets) {
  console.log(`  ${DRY ? "would skip" : "skip"}: ${r.name_display}`);
  if (DRY) continue;
  const res = await fetch(`${base}?id=eq.${r.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ outreach_status: "skip" }) });
  if (res.ok) n++; else console.error("fail", r.name_display, await res.text());
}
console.log(`\n${DRY ? "would skip" : "skipped"}=${DRY ? targets.length : n}`);
