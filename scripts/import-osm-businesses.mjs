#!/usr/bin/env node
/**
 * Phase A pull: OSM Overpass → Supabase businesses table.
 * Bbox covers 17th St (Wilmington) south to Kure Beach, river to coast.
 * Tags pulled: shop=*, amenity=restaurant|cafe|bar|pharmacy|dentist|doctors|
 *   clinic|veterinary|car_repair|car_wash|fast_food|pub|bank, office=*.
 *
 * Upserts into businesses with source='osm'. Tags zone based on lat.
 * Does not overwrite existing rows (preserves canonical names, prior_sponsor flags).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local
try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

// 17th St area is roughly 34.235N; Kure Beach south is ~34.015N
// East coastline ~-77.82W; West (River Rd / west of Carolina Beach Rd) ~-77.97W
const BBOX = { south: 34.015, west: -77.97, north: 34.235, east: -77.82 };

const QUERY = `
[out:json][timeout:90];
(
  node["shop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["shop"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|bank|dentist|doctors|clinic|veterinary|car_repair|car_wash|fuel|optician|hairdresser)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|bank|dentist|doctors|clinic|veterinary|car_repair|car_wash|fuel|optician|hairdresser)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["office"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["office"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out center tags;
`;

function canonicalName(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function zoneFromLat(lat) {
  if (!lat) return null;
  if (lat < 34.075) return "carolina-beach";   // CB + Kure
  if (lat < 34.18) return "mid-corridor";       // Monkey Junction / Myrtle Grove / AHS area
  return "north-17th";                          // 17th St / Wilmington proper
}

// Skip list — chains, big-box, anything explicitly excluded per CLAUDE.md
const SKIP_PATTERNS = [
  /^(target|walmart|wal-mart|home depot|lowe'?s|sam'?s club|costco|bj'?s)/i,
  /^(mcdonald'?s|burger king|wendy'?s|taco bell|kfc|chick-?fil-?a|popeyes|sonic|hardee'?s|arby'?s)/i,
  /^(subway|jimmy john'?s|jersey mike'?s|firehouse subs|panera|chipotle|qdoba|moe'?s)/i,
  /^(starbucks|dunkin|dunkin'? donuts|krispy kreme|tim hortons)/i,
  /^(domino'?s|pizza hut|papa john'?s|little caesars|papa murphy'?s)/i,
  /^(applebee'?s|chili'?s|outback|olive garden|red lobster|ihop|denny'?s|cracker barrel)/i,
  /^(cvs|walgreens|rite aid|duane reade)/i,
  /^(bank of america|wells fargo|chase|truist|bb&t|suntrust|pnc|td bank|citibank|capital one|us bank)/i,
  /^(shell|exxon|bp|chevron|mobil|valero|sunoco|7-?eleven|circle k|wawa|sheetz|speedway)/i,
  /^(family dollar|dollar general|dollar tree|five below)/i,
  /^(at&t|verizon|t-mobile|sprint|xfinity|spectrum)/i,
  /^music & arts/i,
];

function shouldSkip(name) {
  if (!name) return true;
  return SKIP_PATTERNS.some(r => r.test(name));
}

function tagToCategory(tags) {
  if (tags.shop) return `shop:${tags.shop}`;
  if (tags.amenity) return `amenity:${tags.amenity}`;
  if (tags.office) return `office:${tags.office}`;
  return null;
}

function buildAddress(tags) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
  ].filter(Boolean).join(" ");
  return parts || null;
}

async function fetchOverpass() {
  console.log("Fetching from Overpass API...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ashleybands.com sponsorship-prospect-import (contact: robert.parker@nhcs.net)"
    },
    body: "data=" + encodeURIComponent(QUERY)
  });
  if (!res.ok) {
    throw new Error(`Overpass failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsertBusiness(b) {
  const base = `${url}/rest/v1/businesses`;
  const headers = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json"
  };
  // Look up existing by canonical name
  const lookup = await fetch(
    `${base}?name_canonical=eq.${encodeURIComponent(b.name_canonical)}&select=id,source`,
    { headers }
  );
  const existing = await lookup.json();
  if (Array.isArray(existing) && existing.length > 0) {
    return { status: "exists", id: existing[0].id, source: existing[0].source };
  }
  // Insert
  const insRes = await fetch(base, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(b)
  });
  if (!insRes.ok) {
    const txt = await insRes.text();
    return { status: "error", error: txt };
  }
  const ins = await insRes.json();
  return { status: "inserted", id: ins[0].id };
}

const data = await fetchOverpass();
console.log(`Overpass returned ${data.elements.length} elements`);

const records = [];
const seen = new Set();
for (const el of data.elements) {
  const tags = el.tags || {};
  const name = tags.name;
  if (!name) continue;
  if (shouldSkip(name)) continue;
  const canon = canonicalName(name);
  if (seen.has(canon)) continue;
  seen.add(canon);
  const lat = el.lat ?? el.center?.lat ?? null;
  records.push({
    name_canonical: canon,
    name_display: name.trim(),
    address: buildAddress(tags),
    city: tags["addr:city"] || null,
    zip: tags["addr:postcode"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    email: tags.email || tags["contact:email"] || null,
    category: tagToCategory(tags),
    zone: zoneFromLat(lat),
    source: "osm",
    outreach_status: "untested",
    notes: el.type === "way" ? `osm_way:${el.id}` : `osm_node:${el.id}`
  });
}
console.log(`After dedupe + skip filter: ${records.length} candidates`);

let inserted = 0, existed = 0, errored = 0;
for (const r of records) {
  const out = await upsertBusiness(r);
  if (out.status === "inserted") inserted++;
  else if (out.status === "exists") existed++;
  else { errored++; console.error("ERR:", r.name_display, out.error); }
}

console.log(`\nDone. inserted=${inserted} existed=${existed} errored=${errored}`);
