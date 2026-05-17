#!/usr/bin/env node
/**
 * Seed AHS Athletics/Cheer 2025 sponsors into businesses table.
 * Pulled from "Varsity Football Timeline / PA Announcments" Google Doc
 * owned by Drew Hackett, last read 2026-05-17.
 *
 * These are proven willing AHS sponsors but for athletics, not band.
 * Tagged source='manual:athletics-prior-2025' so we can filter the
 * dashboard for an "AD coordination required" review batch before
 * any band-side outreach.
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

const NOTE = "Active Ashley Athletics/Cheer sponsor 2025 per PA script. Coordinate with AD (likely Dante Lombardi) before any band outreach — these businesses already chose AHS once, but we don't want to step on athletic relationships.";

const ATHLETICS = [
  // Game-play sponsors + Q1 Football
  { name_display: "Grand View Renovations", category: "service:renovations", notes: NOTE + " Game-play sponsor: 1st Downs." },
  { name_display: "Network Real Estate", category: "office:realty", notes: NOTE + " Game-play sponsor: 3rd Downs." },
  { name_display: "The Muffler Place", category: "amenity:car_repair", notes: NOTE + " Game-play sponsor: Kickoffs." },
  { name_display: "Jeremiah Barnett", category: "personal", notes: NOTE + " Game-play sponsor: Punts. Likely individual donor, verify before treating as business." },
  { name_display: "Ashley Wescott Electric", category: "service:electrician", notes: NOTE + " Game-play sponsor: PATs." },
  { name_display: "Phillips Air Care", category: "service:hvac", notes: NOTE + " Also Cheer sponsor." },
  { name_display: "Island Burgers", category: "amenity:restaurant", zone: "carolina-beach", notes: NOTE },
  { name_display: "Kure Beach Pier", category: "amenity:tourism", zone: "carolina-beach", notes: NOTE },
  { name_display: "Alison Keller of Coldwell Banker Realty", category: "office:realty", notes: NOTE + " Individual realtor at Coldwell Banker." },
  { name_display: "Center City Development INC", category: "office:development", notes: NOTE },
  { name_display: "Coastal Accounting & Tax", category: "office:accountant", notes: NOTE },
  { name_display: "Seven Seas Inn", category: "amenity:hotel", zone: "carolina-beach", notes: NOTE },
  { name_display: "Seaworthy Kitchen", category: "amenity:restaurant", notes: NOTE },
  { name_display: "Goin Coastal Linen", category: "service:linen", notes: NOTE },
  { name_display: "Playa Bowls", category: "amenity:restaurant", notes: NOTE },
  { name_display: "Lifepoint Church", category: "amenity:church", notes: NOTE },
  { name_display: "Michael & Son Services", category: "service:home_services", notes: NOTE },
  { name_display: "South Wind Motels of Kure Beach", category: "amenity:hotel", zone: "carolina-beach", notes: NOTE },
  { name_display: "Beach Taxi Adventures", category: "service:taxi", zone: "carolina-beach", notes: NOTE },
  { name_display: "Brunches", category: "amenity:restaurant", notes: NOTE + " Provides pre-game meals." },
  { name_display: "Farm Bureau", category: "office:insurance", notes: NOTE + " ANCHOR: Field Sponsor for Ashley Athletics." },
  // Q2 Cheer sponsors (Cheer-specific, not also football)
  { name_display: "ChadsWorth Incorporated", category: "service:home_services", notes: NOTE + " Cheer sponsor." },
  { name_display: "Cheer Infinity", category: "service:cheer_gym", notes: NOTE + " Cheer sponsor — likely cheer-specific affinity." },
  { name_display: "C. Clayton Walker III, DDS", category: "amenity:dentist", notes: NOTE + " Cheer sponsor." }
];

let inserted = 0, existed = 0;
for (const r of ATHLETICS) {
  r.name_canonical = canon(r.name_display);
  r.source = "manual:athletics-prior-2025";
  r.outreach_status = "untested";
  const lookup = await fetch(
    `${base}?name_canonical=eq.${encodeURIComponent(r.name_canonical)}&select=id,source`,
    { headers }
  );
  const existing = await lookup.json();
  if (Array.isArray(existing) && existing.length > 0) {
    // Update notes + source to reflect athletics history, but don't overwrite a richer existing row
    existed++;
    console.log(`exists: ${r.name_display} (source=${existing[0].source})`);
    continue;
  }
  const res = await fetch(base, { method: "POST", headers, body: JSON.stringify(r) });
  if (!res.ok) console.error("fail:", r.name_display, await res.text());
  else { inserted++; console.log(`inserted: ${r.name_display}`); }
}
console.log(`\ninserted=${inserted} existed=${existed}`);
