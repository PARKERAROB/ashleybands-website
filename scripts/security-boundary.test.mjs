import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const PRIVATE_OPERATIONAL_TABLES = [
  "instrument_inventory",
  "music_library_inventory",
  "portal_instrument_requests",
  "portal_clothing_orders",
  "portal_clothing_order_items",
];

const migrationDir = path.resolve("supabase", "migrations");
const migrations = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(path.join(migrationDir, name), "utf8"))
  .join("\n")
  .toLowerCase();

function escapedTable(table) {
  return table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("private operational tables enable row-level security", () => {
  for (const table of PRIVATE_OPERATIONAL_TABLES) {
    assert.match(
      migrations,
      new RegExp(`alter\\s+table\\s+public\\.${escapedTable(table)}\\s+enable\\s+row\\s+level\\s+security\\s*;`),
      `${table} must enable row-level security`,
    );
  }
});

test("private operational tables revoke browser-role privileges", () => {
  for (const table of PRIVATE_OPERATIONAL_TABLES) {
    assert.match(
      migrations,
      new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+table\\s+public\\.${escapedTable(table)}\\s+from\\s+anon\\s*,\\s*authenticated\\s*;`),
      `${table} must revoke direct browser-role privileges`,
    );
  }
});

test("production publishable key cannot read private operational rows", {
  skip: process.env.SECURITY_LIVE !== "1",
}, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "live boundary check requires the production publishable configuration");

  for (const table of PRIVATE_OPERATIONAL_TABLES) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const body = await response.json();
    assert.equal(
      Array.isArray(body) ? body.length : 0,
      0,
      `${table} exposed a row to the production publishable key`,
    );
  }
});
