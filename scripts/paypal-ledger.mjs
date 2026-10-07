#!/usr/bin/env node
/**
 * Read-only PayPal ledger for the boosters money sheet (#183).
 *
 *   node scripts/paypal-ledger.mjs                 # balance + TSV rows since 2026-05-01
 *   node scripts/paypal-ledger.mjs --since 2026-09-01
 *   node scripts/paypal-ledger.mjs --selftest      # offline check of the row logic
 *
 * Uses a separate live PayPal reporting app (Transaction Search permission only):
 * PAYPAL_REPORT_CLIENT_ID / PAYPAL_REPORT_CLIENT_SECRET in .env.local. The website's
 * payment app is not used. Student and category come from the portal's own records,
 * matched on the PayPal transaction ID. Writes nothing anywhere; prints to stdout.
 */
import assert from "node:assert/strict";
import { loadBandWebsiteEnv } from "./lib/workspace-paths.mjs";

const API = "https://api-m.paypal.com";
const HEADER = ["Date", "Payer", "Student", "Category", "Gross", "Fee", "Net", "Type", "PayPal transaction ID", "Invoice ID"];

// PayPal T-codes we expect; anything else prints its raw code.
const TYPES = {
  T0006: "Payment received", T0011: "Payment received", T0013: "Donation received",
  T0000: "Payment received", T0001: "Payment sent", T0003: "Purchase", T0007: "Purchase",
  T0400: "Transfer to bank", T0403: "Transfer to bank", T1107: "Refund", T1106: "Reversal"
};

const money = v => (v == null ? "" : Number(v).toFixed(2));
const usDate = iso => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};
const nameOf = s => (s ? `${s.legal_last}, ${s.preferred_first || s.legal_first}` : "");

export function toRow(detail, portal) {
  const t = detail.transaction_info;
  const payer = detail.payer_info?.payer_name?.alternate_full_name
    || [detail.payer_info?.payer_name?.given_name, detail.payer_info?.payer_name?.surname].filter(Boolean).join(" ")
    || detail.shipping_info?.name || "";
  const hit = portal.get(t.transaction_id);
  return [
    usDate(t.transaction_initiation_date),
    hit?.payer || payer,
    hit?.student || "",
    hit?.category || "",
    money(t.transaction_amount?.value),
    money(t.fee_amount?.value),
    money(Number(t.transaction_amount?.value || 0) + Number(t.fee_amount?.value || 0)),
    TYPES[t.transaction_event_code] || t.transaction_event_code,
    t.transaction_id,
    t.invoice_id || ""
  ];
}

// PayPal limits each search to 31 days.
export function windows(since, until) {
  const out = [];
  for (let start = new Date(since); start < until;) {
    const end = new Date(Math.min(start.getTime() + 31 * 864e5 - 1000, until.getTime()));
    out.push([start.toISOString().slice(0, 19) + "Z", end.toISOString().slice(0, 19) + "Z"]);
    start = new Date(end.getTime() + 1000);
  }
  return out;
}

async function paypal() {
  const id = process.env.PAYPAL_REPORT_CLIENT_ID;
  const secret = process.env.PAYPAL_REPORT_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Add PAYPAL_REPORT_CLIENT_ID and PAYPAL_REPORT_CLIENT_SECRET to .env.local (live reporting app).");
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status}). Check the reporting app's live credentials.`);
  const token = (await res.json()).access_token;
  return async path => {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 403) throw new Error("PayPal refused the report. Turn on 'Transaction search' for the reporting app.");
    if (!r.ok) throw new Error(`PayPal ${path.split("?")[0]} failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
}

async function portalMatches() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const get = async q => {
    const r = await fetch(`${base}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Portal read failed (${r.status})`);
    return r.json();
  };
  const [students, fees, gifts] = await Promise.all([
    get("portal_students?select=id,legal_first,legal_last,preferred_first"),
    get("fee_payments?select=paypal_capture_id,student_id,category,payer_name&paypal_capture_id=not.is.null"),
    get("sponsor_gifts?select=paypal_capture_id,portal_student_id,campaign_code,business_name&paypal_capture_id=not.is.null")
  ]);
  const byId = new Map(students.map(s => [s.id, s]));
  const map = new Map();
  for (const f of fees) map.set(f.paypal_capture_id, { student: nameOf(byId.get(f.student_id)), category: f.category, payer: f.payer_name });
  for (const g of gifts) map.set(g.paypal_capture_id, { student: nameOf(byId.get(g.portal_student_id)), category: `sponsor: ${g.campaign_code}`, payer: g.business_name });
  return map;
}

async function main() {
  loadBandWebsiteEnv();
  const at = process.argv.indexOf("--since");
  const since = at > 0 ? process.argv[at + 1] : "2026-05-01";
  const read = await paypal();
  const balances = await read("/v1/reporting/balances?currency_code=USD");
  const usd = balances.balances?.find(b => b.currency === "USD");
  const portal = await portalMatches();
  const rows = [];
  for (const [start, end] of windows(since, new Date())) {
    for (let page = 1, pages = 1; page <= pages; page++) {
      const json = await read(`/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=500&page=${page}`);
      pages = json.total_pages || 1;
      for (const d of json.transaction_details || []) rows.push(toRow(d, portal));
    }
  }
  console.error(`PayPal balance (available): $${money(usd?.available_balance?.value)} as of ${balances.as_of_time || "now"}`);
  console.error(`${rows.length} transactions since ${since}`);
  console.log([HEADER, ...rows].map(r => r.join("\t")).join("\n"));
}

function selftest() {
  const portal = new Map([["CAP1", { student: "Hill, Cyrus", category: "marching_band_2026", payer: "Family (band website)" }]]);
  const row = toRow({
    transaction_info: { transaction_id: "CAP1", transaction_event_code: "T0006", transaction_initiation_date: "2026-06-19T14:00:00+0000", transaction_amount: { value: "250.00" }, fee_amount: { value: "-9.22" }, invoice_id: "AB-1" },
    payer_info: { payer_name: { alternate_full_name: "Someone" } }
  }, portal);
  assert.ok(row.join("|") === "6/19/2026|Family (band website)|Hill, Cyrus|marching_band_2026|250.00|-9.22|240.78|Payment received|CAP1|AB-1", row.join("|"));
  const w = windows("2026-05-01", new Date("2026-07-15T00:00:00Z"));
  assert.ok(w.length === 3 && w[0][0] === "2026-05-01T00:00:00Z" && w[2][1] === "2026-07-15T00:00:00Z", JSON.stringify(w));
  console.log("paypal-ledger selftest OK");
}

if (process.argv.includes("--selftest")) selftest();
else main().catch(e => { console.error(e.message); process.exit(1); });
