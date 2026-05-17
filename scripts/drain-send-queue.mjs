#!/usr/bin/env node
/**
 * Phase C dispatcher: drain queued business_outreach rows from Supabase
 * and send each via gws gmail. Runs locally on Mr. Parker's machine because
 * the gws CLI uses his existing NHCS Gmail auth — no Gmail API OAuth needed
 * in the web app.
 *
 * Usage:
 *   node scripts/drain-send-queue.mjs                # send all queued, 10s between
 *   node scripts/drain-send-queue.mjs --limit 10     # cap at 10 sends this run
 *   node scripts/drain-send-queue.mjs --dry-run      # preview, don't actually send
 *   node scripts/drain-send-queue.mjs --sleep 30     # 30s between sends
 *
 * Defaults:
 *   --limit  unlimited (will respect Gmail daily caps naturally)
 *   --sleep  10 seconds between sends
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  COLD_EMAIL_SUBJECT,
  renderColdEmailHTML,
  renderColdEmailText
} from "../lib/businessOutreachEmail.js";

// Load .env.local
try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const args = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = args.indexOf(name);
  if (i === -1) return def;
  return args[i + 1] ?? true;
};
const LIMIT = parseInt(flag("--limit", "0"), 10) || 0;
const SLEEP_MS = (parseInt(flag("--sleep", "10"), 10) || 10) * 1000;
const DRY_RUN = args.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}
const sbHeaders = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json"
};

async function fetchQueued() {
  const params = new URLSearchParams({
    select:
      "id,business_id,sent_to_email,click_token,yes_url,no_url,campaign,business:businesses(name_display,contact_person)",
    send_status: "eq.queued",
    order: "queued_at.asc"
  });
  const res = await fetch(`${url}/rest/v1/business_outreach?${params}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function updateOutreach(id, patch) {
  const res = await fetch(`${url}/rest/v1/business_outreach?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...sbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(patch)
  });
  if (!res.ok) console.error("update fail:", await res.text());
}

function buildRaw({ to, subject, html, text }) {
  const boundary = `bdy_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alt_${Math.random().toString(36).slice(2)}`;
  // Gmail accepts a single text/html part; we'll send multipart/alternative for max compatibility.
  const msg = [
    `From: robert.parker@nhcs.net`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    text,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    html,
    ``,
    `--${altBoundary}--`,
    ``
  ].join("\r\n");
  return Buffer.from(msg, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sendViaGws(raw) {
  const payload = JSON.stringify({ message: { raw } });
  const r = spawnSync(
    "gws",
    ["gmail", "users", "messages", "send", "--params", '{"userId":"me"}', "--json", payload],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  if (r.status !== 0) {
    return { ok: false, error: r.stderr || r.stdout || "unknown gws error" };
  }
  try {
    const out = JSON.parse(r.stdout);
    return { ok: true, gmailId: out.id };
  } catch (e) {
    return { ok: false, error: `parse fail: ${r.stdout}` };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const queued = await fetchQueued();
console.log(`${queued.length} queued outreach row(s)`);
if (queued.length === 0) process.exit(0);

const work = LIMIT > 0 ? queued.slice(0, LIMIT) : queued;
console.log(`Sending ${work.length} (limit=${LIMIT || "none"}, sleep=${SLEEP_MS / 1000}s, dry-run=${DRY_RUN})`);
console.log("---");

let sent = 0, failed = 0;
for (let i = 0; i < work.length; i++) {
  const o = work[i];
  const biz = o.business || {};
  const businessName = biz.name_display || "your business";
  const contactFirst = biz.contact_person ? biz.contact_person.split(/\s+/)[0] : "";

  const html = renderColdEmailHTML({
    businessName,
    contactFirst,
    yesUrl: o.yes_url,
    noUrl: o.no_url
  });
  const text = renderColdEmailText({
    businessName,
    contactFirst,
    yesUrl: o.yes_url,
    noUrl: o.no_url
  });

  if (DRY_RUN) {
    console.log(`[DRY] ${i + 1}/${work.length}: ${o.sent_to_email} (${businessName})`);
    continue;
  }

  const raw = buildRaw({
    to: o.sent_to_email,
    subject: COLD_EMAIL_SUBJECT,
    html,
    text
  });
  const r = sendViaGws(raw);
  if (r.ok) {
    sent++;
    await updateOutreach(o.id, {
      send_status: "sent",
      sent_at: new Date().toISOString(),
      gmail_message_id: r.gmailId
    });
    console.log(`  sent ${i + 1}/${work.length}: ${o.sent_to_email} (gmail ${r.gmailId})`);
  } else {
    failed++;
    await updateOutreach(o.id, {
      send_status: "failed",
      send_error: r.error.slice(0, 500)
    });
    console.error(`  FAIL ${i + 1}/${work.length}: ${o.sent_to_email}: ${r.error.slice(0, 200)}`);
  }

  if (i < work.length - 1) await sleep(SLEEP_MS);
}

console.log("---");
console.log(`Done. sent=${sent} failed=${failed}`);
