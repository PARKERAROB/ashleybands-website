#!/usr/bin/env node
/**
 * One-time staff seeder for the sponsorship dashboard.
 * Usage: node scripts/seed-staff.mjs <email> <display_name> <role> <pin>
 * Uses PostgREST directly to avoid supabase-js realtime/websocket dep on Node 20.
 */
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

try {
  for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const [, , email, displayName, role, pin] = process.argv;
if (!email || !displayName || !role || !pin) {
  console.error("Usage: node scripts/seed-staff.mjs <email> <display_name> <role> <pin>");
  process.exit(1);
}
if (!["director", "sponsor_lead"].includes(role)) {
  console.error('role must be "director" or "sponsor_lead"');
  process.exit(1);
}
if (!/^\d{4,8}$/.test(pin)) {
  console.error("pin must be 4-8 digits");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const base = `${url}/rest/v1/staff`;
const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};
const normEmail = email.trim().toLowerCase();
const pin_hash = bcrypt.hashSync(pin, 10);

const lookup = await fetch(`${base}?email=eq.${encodeURIComponent(normEmail)}&select=id`, { headers });
const existing = await lookup.json();

if (Array.isArray(existing) && existing.length > 0) {
  const id = existing[0].id;
  const res = await fetch(`${base}?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ pin_hash, display_name: displayName, role })
  });
  if (!res.ok) {
    console.error("Update failed:", res.status, await res.text());
    process.exit(1);
  }
  console.log(`Updated staff ${normEmail} (${role}) with new PIN.`);
} else {
  const res = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: normEmail, pin_hash, display_name: displayName, role })
  });
  if (!res.ok) {
    console.error("Insert failed:", res.status, await res.text());
    process.exit(1);
  }
  console.log(`Created staff ${normEmail} as ${role}.`);
}
