#!/usr/bin/env node
/**
 * Render a human view of the sponsorship prospect database (Rob never reads the
 * raw table). Pulls live businesses, groups the cold-email-ready list by distance
 * ring from Ashley, shows confidence + provenance, and lists the gaps.
 *
 * Output: data/_work/sponsorship-prospects.html
 */
import { readFileSync, writeFileSync } from "node:fs";
const ENV = "/Users/parkerarob/Atlas/band-website/.env.local";
for (const line of readFileSync(ENV, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY;
const rows = await (await fetch(`${url}/rest/v1/businesses?select=*&order=distance_mi.asc`, { headers: { apikey: secret, Authorization: `Bearer ${secret}` } })).json();
const has = (f) => (r) => r[f] && String(r[f]).trim();
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// confidence is recorded in notes ("Email via Firecrawl ... (high|medium)")
const conf = (r) => { const m = String(r.notes || "").match(/Email via Firecrawl[^\n]*\((high|medium)\)/); return m ? m[1] : (r.email ? "set" : ""); };
const ready = rows.filter((r) => r.outreach_status === "untested" && has("email")(r));
const ring = (d) => d == null ? "Unmapped" : d <= 3 ? "0-3 mi (closest)" : d <= 6 ? "3-6 mi" : d <= 10 ? "6-10 mi" : "10 mi+";
const order = ["0-3 mi (closest)", "3-6 mi", "6-10 mi", "10 mi+", "Unmapped"];
const groups = {}; ready.forEach((r) => (groups[ring(r.distance_mi)] ||= []).push(r));

const callOnly = rows.filter((r) => r.outreach_status === "untested" && !has("email")(r) && has("phone")(r));
const noContact = rows.filter((r) => r.outreach_status === "untested" && !has("email")(r) && !has("phone")(r));
const review = rows.filter((r) => /Low-confidence email candidates/.test(r.notes || ""));

const badge = (c) => c === "high" ? '<span class="b hi">high</span>' : c === "medium" ? '<span class="b me">med</span>' : "";
const rowHtml = (r) => `<tr><td class="d">${r.distance_mi ?? "—"}</td><td>${esc(r.name_display)}</td><td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a> ${badge(conf(r))}</td><td>${esc(r.phone || "")}</td><td>${esc(r.address || "")}</td></tr>`;

let body = `<h1>AHS Band — Sponsorship Prospects</h1>
<p class="sub">Generated ${new Date().toLocaleString()} · ${rows.length} businesses · <b>${ready.length}</b> cold-email-ready, ranked outward from Ashley.</p>
<div class="legend">${badge("high")} business-domain role address — safe to send &nbsp; ${badge("medium")} found via search — <b>sanity-check the business/location before sending</b></div>`;

for (const g of order) {
  if (!groups[g]?.length) continue;
  body += `<h2>${g} <span class="cnt">${groups[g].length}</span></h2>
  <table><thead><tr><th>mi</th><th>Business</th><th>Email</th><th>Phone</th><th>Address</th></tr></thead><tbody>${groups[g].map(rowHtml).join("")}</tbody></table>`;
}
body += `<h2>Gaps — no email yet</h2>
<p><b>${callOnly.length}</b> have a phone but no email (call or walk-in only). <b>${noContact.length}</b> have neither (need discovery). <b>${review.length}</b> have low-confidence email candidates flagged in notes for verification.</p>`;

const html = `<!doctype html><meta charset=utf8><title>AHS Band Sponsorship Prospects</title>
<style>
body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#1a1a1a}
h1{margin:0 0 4px} .sub{color:#555;margin:0 0 12px} h2{margin:28px 0 6px;border-bottom:2px solid #eee;padding-bottom:4px}
.cnt{font-size:13px;color:#fff;background:#2a6;border-radius:10px;padding:1px 8px;vertical-align:middle}
table{border-collapse:collapse;width:100%;font-size:14px} th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #eee}
th{background:#fafafa;font-size:12px;text-transform:uppercase;color:#666} td.d{color:#888;white-space:nowrap} td a{color:#1559c4}
.b{font-size:11px;padding:1px 6px;border-radius:8px;color:#fff} .hi{background:#2a7} .me{background:#e6a100}
.legend{font-size:13px;color:#444;background:#f6f8fa;border:1px solid #e3e7eb;border-radius:8px;padding:8px 12px;margin:10px 0}
</style>${body}`;
const OUT = "/Users/parkerarob/Atlas/BandsofAHS/data/_work/sponsorship-prospects.html";
writeFileSync(OUT, html);
console.log("wrote", OUT, `(${ready.length} ready)`);
