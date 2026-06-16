#!/usr/bin/env node
/**
 * Apply offline business-prospect enrichment CSVs from BandDirectorOS to the
 * Supabase-backed businesses table used by /sponsors/dashboard/businesses.
 *
 * Usage:
 *   node scripts/apply-business-enrichment.mjs
 *   node scripts/apply-business-enrichment.mjs --dry-run
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = "/Users/parkerarob/Atlas/BandsofAHS/data";
const DRY_RUN = process.argv.includes("--dry-run");

try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const base = `${url}/rest/v1/businesses`;
const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

const canon = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        field += "\"";
        i++;
      } else if (ch === "\"") {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headersRow, ...dataRows] = rows.filter((r) => r.some((v) => v !== ""));
  return dataRows.map((values) =>
    Object.fromEntries(headersRow.map((key, i) => [key, values[i] || ""]))
  );
}

function readCsv(name) {
  return parseCsv(readFileSync(join(DATA_DIR, name), "utf8"));
}

function noteLine(label, sourceUrl) {
  return sourceUrl ? `${label}: ${sourceUrl}` : label;
}

function appendNote(existing, line) {
  const notes = existing || "";
  if (!line || notes.includes(line)) return notes || null;
  return notes ? `${notes}\n${line}` : line;
}

async function getBusiness(nameDisplay) {
  const nameCanonical = canon(nameDisplay);
  const res = await fetch(
    `${base}?name_canonical=eq.${encodeURIComponent(nameCanonical)}&select=*`,
    { headers }
  );
  if (!res.ok) throw new Error(`Lookup failed for ${nameDisplay}: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function patchBusiness(id, update) {
  if (DRY_RUN) return { dryRun: true };
  const res = await fetch(`${base}?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(update)
  });
  if (!res.ok) throw new Error(`Update failed for ${id}: ${await res.text()}`);
  return res.json();
}

const emailRows = readCsv("business-prospects-email-enrichment.csv");
const contactRows = readCsv("business-prospects-carolina-beach-contacts.csv");
const skipRows = readCsv("business-prospects-skip-list.csv");
const zoneRows = readCsv("business-prospects-zone-corrections.csv");

const updates = new Map();

function mergeUpdate(nameDisplay, updateBuilder) {
  const key = canon(nameDisplay);
  const current = updates.get(key) || { name_display: nameDisplay, build: [] };
  current.build.push(updateBuilder);
  updates.set(key, current);
}

for (const row of emailRows) {
  mergeUpdate(row.name_display, (biz) => ({
    email: row.email_found,
    enriched_at: new Date().toISOString(),
    notes: appendNote(biz.notes, noteLine("Email enrichment source", row.source_url))
  }));
}

for (const row of contactRows) {
  mergeUpdate(row.name_display, (biz) => ({
    contact_person: biz.contact_person || row.contact_person_found,
    contact_title: biz.contact_title || row.contact_title_found,
    enriched_at: new Date().toISOString(),
    notes: appendNote(biz.notes, noteLine("Contact enrichment source", row.source_url))
  }));
}

for (const row of skipRows) {
  mergeUpdate(row.name_display, (biz) => ({
    outreach_status: ["already-sponsor", "willing", "declined"].includes(biz.outreach_status)
      ? biz.outreach_status
      : "skip",
    enriched_at: new Date().toISOString(),
    notes: appendNote(biz.notes, "Skip-list enrichment: B2B-only, government/nonprofit/church sensitivity, defunct, or poor-fit prospect.")
  }));
}

for (const row of zoneRows) {
  mergeUpdate(row.name_display, (biz) => ({
    zone: row.suggested_zone,
    enriched_at: new Date().toISOString(),
    notes: appendNote(biz.notes, `Zone correction: ${row.reason}`)
  }));
}

let updated = 0;
let skippedMissing = 0;
for (const item of updates.values()) {
  const biz = await getBusiness(item.name_display);
  if (!biz) {
    skippedMissing++;
    console.warn(`missing in Supabase: ${item.name_display}`);
    continue;
  }

  let update = {};
  for (const build of item.build) {
    update = { ...update, ...build({ ...biz, ...update }) };
  }

  await patchBusiness(biz.id, update);
  updated++;
  const action = DRY_RUN ? "would update" : "updated";
  console.log(`${action}: ${item.name_display}`);
}

console.log(`\n${DRY_RUN ? "would_update" : "updated"}=${updated} missing=${skippedMissing}`);
