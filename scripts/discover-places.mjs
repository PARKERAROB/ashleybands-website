#!/usr/bin/env node
/**
 * Discover net-new local sponsorship prospects near Ashley HS via Google
 * Places API (New) Nearby Search, strictly bounded to a radius around the
 * school. Fills the close-ring gap that OSM left thin.
 *
 * For each sponsorable category we issue one Nearby Search (max 20 results,
 * ranked by distance) restricted to a circle centered on Ashley. We then:
 *   - drop national chains and non-operational places,
 *   - dedup against the existing businesses table (by canonical name),
 *   - keep name/address/phone/website/coords (Places gives all but email),
 *   - compute distance_mi from Ashley.
 *
 * Email is NOT in Places — net-new rows are inserted with no email and then
 * picked up by enrich-contacts-firecrawl.mjs on its next run.
 *
 * Usage:
 *   node scripts/discover-places.mjs --dry-run     # report net-new, insert nothing
 *   node scripts/discover-places.mjs               # insert net-new
 *   node scripts/discover-places.mjs --radius 8000 # meters (default 8000 = ~5mi)
 */
import { readFileSync } from "node:fs";

const ASHLEY = { lat: 34.1002820, lng: -77.9117205 };
const DRY = process.argv.includes("--dry-run");
const RADIUS = (() => { const i = process.argv.indexOf("--radius"); return i > -1 ? Number(process.argv[i + 1]) : 8000; })();
const ENV = "/Users/parkerarob/Atlas/band-website/.env.local";
for (const line of readFileSync(ENV, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL, SECRET = process.env.SUPABASE_SECRET_KEY;
if (!KEY) { console.error("Missing GOOGLE_PLACES_API_KEY"); process.exit(1); }
const base = `${SUPA}/rest/v1/businesses`;
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json", Prefer: "return=representation" };

// Sponsorable local-business categories (Places type table A).
const TYPES = [
  "restaurant", "cafe", "bakery", "bar", "meal_takeaway", "coffee_shop", "ice_cream_shop", "sandwich_shop", "pizza_restaurant",
  "dentist", "doctor", "veterinary_care", "physiotherapist", "chiropractor", "optometrist",
  "car_repair", "car_wash", "car_dealer", "auto_parts_store",
  "real_estate_agency", "insurance_agency", "lawyer", "accounting", "bank",
  "hair_care", "beauty_salon", "nail_salon", "spa", "barber_shop",
  "gym", "fitness_center",
  "clothing_store", "furniture_store", "hardware_store", "florist", "jewelry_store", "pet_store",
  "store", "home_improvement_store", "sporting_goods_store", "book_store", "shoe_store",
  "plumber", "electrician", "roofing_contractor", "moving_company", "storage",
];

const canon = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const CHAIN = [
  /^(target|walmart|wal-mart|home depot|lowe'?s|sam'?s club|costco|bj'?s|big lots|aldi|food lion|harris teeter|publix|trader joe)/i,
  /^(mcdonald'?s|burger king|wendy'?s|taco bell|kfc|chick-?fil-?a|popeyes|sonic|hardee'?s|arby'?s|bojangles|cook ?out|checkers|rally'?s|zaxby'?s|cookout|five guys|culver'?s|whataburger|raising cane)/i,
  /^(subway|jimmy john'?s|jersey mike'?s|firehouse subs|panera|chipotle|qdoba|moe'?s|einstein|jason'?s deli)/i,
  /^(starbucks|dunkin|krispy kreme|tim hortons|biscuitville)/i,
  /^(domino'?s|pizza hut|papa john'?s|little caesars|papa murphy'?s|marco'?s pizza)/i,
  /^(applebee'?s|chili'?s|outback|olive garden|red lobster|ihop|denny'?s|cracker barrel|texas roadhouse|longhorn|ruby tuesday|golden corral|waffle house)/i,
  /^(cvs|walgreens|rite aid)/i,
  /^(bank of america|wells fargo|chase|truist|bb&t|suntrust|pnc|td bank|citibank|capital one|us bank|first citizens|state employees'? credit)/i,
  /^(shell|exxon|bp|chevron|mobil|valero|sunoco|7-?eleven|circle k|wawa|sheetz|speedway|marathon|citgo|kangaroo|murphy usa)/i,
  /^(family dollar|dollar general|dollar tree|five below)/i,
  /^(at&t|verizon|t-mobile|sprint|xfinity|spectrum|metropcs|boost mobile|cricket)/i,
  /^(advance auto|autozone|o'?reilly|napa auto|pep boys|firestone|midas|jiffy lube|valvoline|meineke|take 5)/i,
  /^(aaa |american automobile|planet fitness|anytime fitness|crunch fitness|orangetheory|ymca|gold'?s gym)/i,
  /^(great clips|supercuts|sport clips|fantastic sams|enterprise|hertz|avis|budget|u-?haul|penske|books-a-million)/i,
];
const isChain = (n) => { const s = String(n || "").replace(/^the\s+/i, ""); return CHAIN.some((r) => r.test(s)); };
const zoneFromLat = (lat) => lat == null ? null : lat < 34.075 ? "carolina-beach" : lat < 34.18 ? "mid-corridor" : "north-17th";
const toRad = (d) => (d * Math.PI) / 180;
function miles(b) {
  const R = 3958.8, dLat = toRad(b.lat - ASHLEY.lat), dLon = toRad(b.lng - ASHLEY.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(ASHLEY.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nearby(type) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.location,places.primaryType,places.businessStatus",
    },
    body: JSON.stringify({
      includedTypes: [type], maxResultCount: 20, rankPreference: "DISTANCE",
      locationRestriction: { circle: { center: { latitude: ASHLEY.lat, longitude: ASHLEY.lng }, radius: RADIUS } },
    }),
  });
  if (!res.ok) { console.error(`  ${type}: ${res.status} ${await res.text()}`); return []; }
  return (await res.json()).places || [];
}

// existing canonical names to dedup against
const existing = new Set((await (await fetch(`${base}?select=name_canonical`, { headers: H })).json()).map((r) => r.name_canonical));
console.log(`existing in db: ${existing.size} | radius: ${RADIUS}m (~${(RADIUS / 1609).toFixed(1)}mi) | ${DRY ? "DRY-RUN" : "LIVE"}\n`);

const seen = new Set(), candidates = [];
let chainsDropped = 0, dupes = 0, closed = 0;
for (const type of TYPES) {
  const places = await nearby(type);
  for (const p of places) {
    const name = p.displayName?.text;
    if (!name) continue;
    const c = canon(name);
    if (seen.has(c)) continue;
    if (existing.has(c)) { dupes++; seen.add(c); continue; }
    if (isChain(name)) { chainsDropped++; seen.add(c); continue; }
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") { closed++; seen.add(c); continue; }
    seen.add(c);
    const lat = p.location?.latitude, lng = p.location?.longitude;
    candidates.push({
      name_canonical: c, name_display: name.trim(),
      address: p.formattedAddress || null, phone: p.nationalPhoneNumber || null, website: p.websiteUri || null,
      category: p.primaryType ? `gplace:${p.primaryType}` : null,
      zone: zoneFromLat(lat), source: "google-places", outreach_status: "untested",
      lat: lat ?? null, lon: lng ?? null,
      distance_mi: lat != null ? +miles({ lat, lng }).toFixed(2) : null,
      geocoded_at: lat != null ? new Date().toISOString() : null,
      notes: `Discovered via Google Places (${p.primaryType || "?"}) ${new Date().toISOString().slice(0, 10)}`,
    });
  }
  await sleep(120);
}

candidates.sort((a, b) => (a.distance_mi ?? 99) - (b.distance_mi ?? 99));
console.log(`NET-NEW candidates: ${candidates.length}  (dropped: ${dupes} already-in-db, ${chainsDropped} chains, ${closed} closed)\n`);
console.log("Closest 20 net-new:");
candidates.slice(0, 20).forEach((c) => console.log("  ", String(c.distance_mi).padStart(5), "mi", (c.website ? "[site]" : "[----]"), (c.phone ? "[ph]" : "[--]"), c.name_display));

if (DRY) { console.log(`\nDRY-RUN — inserted nothing. Re-run without --dry-run to insert ${candidates.length}.`); process.exit(0); }

let inserted = 0;
for (const c of candidates) {
  const res = await fetch(base, { method: "POST", headers: H, body: JSON.stringify(c) });
  if (res.ok) inserted++; else console.error("insert fail", c.name_display, await res.text());
}
console.log(`\ninserted=${inserted}`);
