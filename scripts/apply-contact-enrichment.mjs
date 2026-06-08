#!/usr/bin/env node
/**
 * Guarded merge of Firecrawl contact enrichment (data/_work/contact-enrichment.csv)
 * into the businesses table.
 *
 * Rules (deliberately conservative — this feeds cold outreach):
 *   - Only set `email` when it is currently EMPTY. Never overwrite an existing
 *     email (fixes the unconditional-clobber bug in apply-business-enrichment.mjs).
 *   - Only auto-fill email for confidence high|medium. Low-confidence candidates
 *     are written to notes for human review, never into the email field.
 *   - contact-form-only rows: record the form URL in notes (no email set).
 *   - Always append provenance to notes (method + confidence + date). Never
 *     clobber existing notes.
 *
 * Usage: node scripts/apply-contact-enrichment.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";

const CSV = "/Users/parkerarob/Desktop/BandsofAHS/data/_work/contact-enrichment.csv";
const DRY = process.argv.includes("--dry-run");
const ENV = "/Users/parkerarob/Desktop/Band/band-website/.env.local";
for (const line of readFileSync(ENV, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const base = `${url}/rest/v1/businesses`;
const H = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation" };

// minimal CSV parser (quoted fields, embedded commas/quotes)
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) { if (c === '"' && n === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [head, ...data] = rows.filter((r) => r.some((v) => v !== ""));
  return data.map((v) => Object.fromEntries(head.map((k, i) => [k, v[i] || ""])));
}
const appendNote = (existing, line) => {
  const notes = existing || "";
  if (!line || notes.includes(line)) return notes || null;
  return notes ? `${notes}\n${line}` : line;
};
const today = new Date().toISOString().slice(0, 10);

const records = parseCsv(readFileSync(CSV, "utf8"));
console.log(`enrichment rows: ${records.length}${DRY ? " (dry-run)" : ""}`);

let setEmail = 0, formNote = 0, reviewNote = 0, skipped = 0, missing = 0;
for (const r of records) {
  const lookup = await fetch(`${base}?name_canonical=eq.${encodeURIComponent(r.name_canonical)}&select=*`, { headers: H });
  const found = await lookup.json();
  const biz = Array.isArray(found) && found[0];
  if (!biz) { missing++; continue; }

  const update = {};
  if (r.email_found && ["high", "medium"].includes(r.email_confidence)) {
    if (!biz.email || !biz.email.trim()) {
      update.email = r.email_found;
      update.notes = appendNote(biz.notes, `Email via Firecrawl ${r.method} (${r.email_confidence}) ${today}`);
      update.enriched_at = new Date().toISOString();
      setEmail++;
    } else { skipped++; } // already has an email — leave it
  } else if (r.method === "contact-form-only" && r.contact_url) {
    update.notes = appendNote(biz.notes, `No published email; contact form: ${r.contact_url} (${today})`);
    update.enriched_at = new Date().toISOString();
    formNote++;
  } else if (r.email_confidence === "low" && r.email_all) {
    update.notes = appendNote(biz.notes, `Low-confidence email candidates (verify before use): ${r.email_all} (${today})`);
    reviewNote++;
  } else { skipped++; continue; }

  if (Object.keys(update).length === 0) { skipped++; continue; }
  if (DRY) { console.log(`would update ${biz.name_display}: ${JSON.stringify(update.email || update.notes?.split("\n").pop())}`); continue; }
  const res = await fetch(`${base}?id=eq.${biz.id}`, { method: "PATCH", headers: H, body: JSON.stringify(update) });
  if (!res.ok) console.error("fail", biz.name_display, await res.text());
}

console.log(`\n${DRY ? "would " : ""}set_email=${setEmail} form_note=${formNote} review_note=${reviewNote} skipped=${skipped} missing=${missing}`);
