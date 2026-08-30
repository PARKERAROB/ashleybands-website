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
  "band_camp_attendance_2026",
  "attendance_events",
  "attendance_calendar_groups",
  "attendance_event_roster",
  "attendance_event_roster_groups",
  "attendance_observations",
  "attendance_exceptions",
  "attendance_staff_observations",
  "attendance_record_corrections",
  "attendance_observation_revisions",
  "portal_student_external_identifiers",
  "school_attendance_imports",
  "school_attendance_import_sections",
  "school_attendance_import_roster",
  "school_attendance_import_dates",
  "school_attendance_marks",
  "school_attendance_import_issues",
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

const SAFE_FILTER_COLUMN = {
  portal_student_profiles: "student_id",
  portal_student_music_profiles: "student_id",
  portal_student_other_instruments: "student_id",
  portal_student_interests: "student_id",
  portal_onboarding_progress: "student_id",
  group_class_expectations: "group_id",
  band_camp_attendance_2026: "portal_student_id",
  attendance_calendar_groups: "group_id",
  attendance_event_roster: "attendance_event_id",
  attendance_event_roster_groups: "attendance_event_id",
  attendance_observations: "attendance_event_id",
  school_attendance_import_dates: "import_id",
};

async function assertPermissionDenied(response, label) {
  const body = await response.json().catch(() => ({}));
  assert.ok([401, 403].includes(response.status), `${label} returned HTTP ${response.status} instead of permission denied`);
  assert.equal(body?.code, "42501", `${label} returned ${body?.code || "no SQLSTATE"} instead of permission denied`);
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
    await assertPermissionDenied(response, `${table} SELECT`);
  }
});

test("production publishable key cannot write private operational rows", {
  skip: process.env.SECURITY_LIVE !== "1",
}, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "live boundary check requires the production publishable configuration");

  for (const table of PRIVATE_OPERATIONAL_TABLES) {
    const filterColumn = SAFE_FILTER_COLUMN[table] || "id";
    for (const [method, suffix] of [["POST", ""], ["PATCH", `?${filterColumn}=eq.00000000-0000-0000-0000-000000000000`], ["DELETE", `?${filterColumn}=eq.00000000-0000-0000-0000-000000000000`]]) {
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
      await assertPermissionDenied(response, `${table} ${method}`);
    }
  }
});

test("production publishable key cannot execute protected attendance mutations", {
  skip: process.env.SECURITY_LIVE !== "1",
}, async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(url && key, "live boundary check requires the production publishable configuration");
  const requests = [
    ["reconcile_attendance_event_roster", { p_event_id: "00000000-0000-0000-0000-000000000000", p_lock: false }],
    ["adjust_attendance_event_roster", { p_event_id: "00000000-0000-0000-0000-000000000000", p_student_id: "00000000-0000-0000-0000-000000000000", p_include: true, p_actor_staff_id: "00000000-0000-0000-0000-000000000000" }],
    ["complete_attendance_event", { p_event_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: "00000000-0000-0000-0000-000000000000" }],
    ["begin_historical_attendance_reconstruction", { p_event_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: "00000000-0000-0000-0000-000000000000" }],
    ["certify_attendance_event_roster", { p_event_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: "00000000-0000-0000-0000-000000000000", p_note: "test" }],
    ["reopen_attendance_event", { p_event_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: "00000000-0000-0000-0000-000000000000", p_reason: "test" }],
    ["remove_attendance_event_student_with_records", { p_event_id: "00000000-0000-0000-0000-000000000000", p_student_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: "00000000-0000-0000-0000-000000000000", p_reason: "test" }],
    ["correct_attendance_observation", { p_event_id: "00000000-0000-0000-0000-000000000000", p_student_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: "00000000-0000-0000-0000-000000000000", p_status: "present", p_note: null, p_arrived_at: null, p_departed_at: null }],
    ["accept_school_attendance_import", { p_payload: {}, p_actor_staff_id: "00000000-0000-0000-0000-000000000000" }],
  ];
  for (const [name, body] of requests) {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    await assertPermissionDenied(response, `${name} RPC`);
  }
});
