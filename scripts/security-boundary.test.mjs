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
  "portal_schools",
  "portal_instrument_types",
  "portal_interest_types",
  "portal_student_profiles",
  "portal_student_enrollments",
  "portal_student_music_profiles",
  "portal_student_other_instruments",
  "portal_student_interests",
  "portal_student_school_background",
  "portal_support_requests",
  "portal_student_status_events",
  "portal_onboarding_completions",
  "portal_onboarding_progress",
  "portal_onboarding_step_receipts",
  "program_groups",
  "program_memberships",
  "program_membership_events",
  "school_class_sections",
  "student_class_enrollments",
  "group_class_expectations",
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

test("production publishable key cannot write private operational rows", {
  skip: process.env.SECURITY_LIVE !== "1",
}, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "live boundary check requires the production publishable configuration");

  for (const table of PRIVATE_OPERATIONAL_TABLES) {
    for (const [method, suffix] of [["POST", ""], ["PATCH", "?id=eq.00000000-0000-0000-0000-000000000000"], ["DELETE", "?id=eq.00000000-0000-0000-0000-000000000000"]]) {
      const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
        method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: method === "DELETE" ? undefined : "{}",
      });
      assert.ok(!response.ok, `${table} accepted a production publishable-key ${method}`);
    }
  }
});
