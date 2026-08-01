#!/usr/bin/env node
/**
 * Backfill lat/lon + distance-from-Ashley on the businesses table.
 *
 * Coordinates were discarded by the original OSM importer. We recover them two ways:
 *   1. OSM rows store their element id in notes ("osm_node:123" / "osm_way:456").
 *      One batched Overpass call resolves all of those to exact coordinates.
 *   2. Anything still missing is geocoded by street address via Nominatim
 *      (rate-limited to 1 req/sec per their usage policy).
 *
 * distance_mi = great-circle miles from Eugene Ashley HS. Powers "outward from
 * the school" ranking in the dashboard.
 *
 * Usage: node scripts/backfill-geo.mjs [--dry-run]
 */
import { loadBandWebsiteEnv } from "./lib/workspace-paths.mjs";

const ASHLEY = { lat: 34.1002820, lon: -77.9117205 };
const DRY = process.argv.includes("--dry-run");
loadBandWebsiteEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const base = `${url}/rest/v1/businesses`;
const H = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

const toRad = (d) => (d * Math.PI) / 180;
function miles(a, b) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = await (await fetch(`${base}?select=id,name_display,notes,address,city,zip,lat`, { headers: H })).json();
console.log(`businesses: ${rows.length}`);

// 1) Resolve OSM ids in one Overpass batch.
const nodeIds = [], wayIds = [], byOsm = {};
for (const r of rows) {
  const m = String(r.notes || "").match(/osm_(node|way):(\d+)/);
  if (!m) continue;
  if (m[1] === "node") nodeIds.push(m[2]); else wayIds.push(m[2]);
  byOsm[`${m[1]}:${m[2]}`] = r.id;
}
const coordById = {}; // businessId -> {lat,lon}
if (nodeIds.length || wayIds.length) {
  const q = `[out:json][timeout:120];(${nodeIds.length ? `node(id:${nodeIds.join(",")});` : ""}${wayIds.length ? `way(id:${wayIds.join(",")});` : ""});out center;`;
  console.log(`Overpass: ${nodeIds.length} nodes + ${wayIds.length} ways...`);
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ashleybands.com geo backfill (robert.parker@nhcs.net)" },
    body: "data=" + encodeURIComponent(q),
  });
  const data = await res.json();
  for (const el of data.elements || []) {
    const bid = byOsm[`${el.type}:${el.id}`];
    if (!bid) continue;
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat && lon) coordById[bid] = { lat, lon };
  }
  console.log(`resolved from OSM: ${Object.keys(coordById).length}`);
}

// 2) Geocode the remainder by address via Nominatim (rate-limited).
async function nominatim(qy) {
  const u = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qy)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(u, { headers: { "User-Agent": "ashleybands.com sponsorship geo (robert.parker@nhcs.net)" } });
  if (!res.ok) return null;
  const d = await res.json();
  return d[0] ? { lat: +d[0].lat, lon: +d[0].lon } : null;
}
const needGeo = rows.filter((r) => !coordById[r.id] && (r.address || r.city) && r.lat == null);
console.log(`need address geocode: ${needGeo.length}`);
let geo = 0;
for (const r of needGeo) {
  const q = [r.address, r.city || "Wilmington", "NC", r.zip].filter(Boolean).join(", ");
  const c = await nominatim(q);
  if (c) { coordById[r.id] = c; geo++; }
  await sleep(1100);
}
console.log(`geocoded by address: ${geo}`);

// 3) PATCH lat/lon/distance.
let patched = 0;
for (const r of rows) {
  const c = coordById[r.id];
  if (!c) continue;
  const dist = +miles(ASHLEY, c).toFixed(2);
  if (DRY) { patched++; continue; }
  const res = await fetch(`${base}?id=eq.${r.id}`, {
    method: "PATCH", headers: H,
    body: JSON.stringify({ lat: c.lat, lon: c.lon, distance_mi: dist, geocoded_at: new Date().toISOString() }),
  });
  if (res.ok) patched++; else console.error("patch fail", r.name_display, await res.text());
}
console.log(`\n${DRY ? "would patch" : "patched"}=${patched} of ${rows.length}`);
