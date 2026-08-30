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
  "assets",
  "asset_instruments",
  "asset_locks",
  "asset_lock_secrets",
  "asset_assignments",
  "asset_relationships",
  "asset_events",
  "asset_import_runs",
  "asset_import_issues",
  "form_definitions",
  "form_versions",
  "form_requirements",
  "student_form_requirements",
  "form_submission_references",
  "form_requirement_events",
  "fee_charges",
  "fee_payments",
  "paypal_webhook_events",
  "spring_trip_refund_credits",
  "spring_trip_refund_submissions",
  "families",
  "businesses",
  "staff",
  "prospects",
  "business_outreach",
  "sponsor_gifts",
  "sponsor_student_links",
];

const PRIVATE_OPERATIONAL_VIEWS = [
  "student_fee_balances",
  "sponsor_family_totals",
  "sponsor_student_totals",
  "prospect_dedup",
  "business_outreach_rollup",
  "business_touchpoints",
  "student_program_fee_summary",
  "student_campaign_summary",
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

function routeFilesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeFilesUnder(entryPath);
    return entry.name === "route.js" ? [entryPath] : [];
  });
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
  asset_instruments: "asset_id",
  asset_locks: "asset_id",
  asset_lock_secrets: "asset_id",
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
      new RegExp(`alter\\s+table\\s+(?:public\\.)?${escapedTable(table)}\\s+enable\\s+row\\s+level\\s+security\\s*;`),
      `${table} must enable row-level security`,
    );
  }
});

test("private operational views revoke browser-role privileges", () => {
  for (const view of PRIVATE_OPERATIONAL_VIEWS) {
    assert.match(
      migrations,
      new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+table\\s+public\\.${escapedTable(view)}\\s+from\\s+anon\\s*,\\s*authenticated\\s*;`),
      `${view} must revoke direct browser-role privileges`,
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

  for (const resource of [...PRIVATE_OPERATIONAL_TABLES, ...PRIVATE_OPERATIONAL_VIEWS]) {
    const response = await fetch(`${url}/rest/v1/${resource}?select=*&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    await assertPermissionDenied(response, `${resource} SELECT`);
  }
});

test("legacy asset routes require named capabilities and expose only a public aggregate", () => {
  const instrumentAdmin = readFileSync("app/api/instrument-inventory/admin/route.js", "utf8");
  const musicAdmin = readFileSync("app/api/music-library/admin/route.js", "utf8");
  const instrumentRoute = readFileSync("app/api/instrument-inventory/route.js", "utf8");
  const musicRoute = readFileSync("app/api/music-library/route.js", "utf8");

  for (const source of [instrumentAdmin, musicAdmin, instrumentRoute, musicRoute]) {
    assert.match(source, /authorizeStaffRequest/);
    assert.match(source, /ASSETS_(?:READ|WRITE|ASSIGN)/);
    assert.doesNotMatch(source, /validateStaffRequest/);
  }
  assert.match(instrumentAdmin, /ASSETS_READ/);
  assert.match(instrumentAdmin, /ASSETS_ASSIGN/);
  assert.match(musicAdmin, /ASSETS_READ/);
  assert.match(instrumentRoute, /types:\s*\[\.\.\.typeCounts\.entries\(\)\]/);
  assert.doesNotMatch(instrumentRoute, /\binstruments,\s*\n\s*generatedAt/);
  for (const source of [instrumentAdmin, musicAdmin, instrumentRoute, musicRoute]) {
    assert.match(source, /private, no-store/);
  }
});

test("legacy private admin routes use the central capability contract", () => {
  const expected = new Map([
    ["app/api/admin/contacts/route.js", ["STUDENTS_READ", "STUDENTS_WRITE", "CONTACTS_EXPORT"]],
    ["app/api/admin/data-inventory/route.js", ["SYSTEM_DATA_INVENTORY_READ"]],
    ["app/api/admin/broadcast/route.js", ["COMMUNICATIONS_READ"]],
    ["app/api/admin/broadcast/preview/route.js", ["COMMUNICATIONS_READ"]],
    ["app/api/admin/broadcast/send/route.js", ["COMMUNICATIONS_SEND"]],
    ["app/api/admin/newsletter/route.js", ["COMMUNICATIONS_READ", "COMMUNICATIONS_WRITE"]],
    ["app/api/admin/newsletter/preview/route.js", ["COMMUNICATIONS_READ"]],
    ["app/api/admin/newsletter/publish/route.js", ["COMMUNICATIONS_WRITE"]],
    ["app/api/admin/newsletter/send/route.js", ["COMMUNICATIONS_SEND"]],
    ["app/api/admin/clothing-orders/route.js", ["BILLING_READ"]],
    ["app/api/admin/marching-band/route.js", ["MEMBERSHIPS_READ", "MEMBERSHIPS_WRITE"]],
    ["app/api/admin/measurements/route.js", ["STUDENTS_READ", "STUDENTS_WRITE"]],
    ["app/api/admin/sizes/route.js", ["STUDENTS_READ", "STUDENTS_WRITE"]],
    ["app/api/admin/students/guardians/route.js", ["STUDENTS_WRITE"]],
    ["app/api/admin/students/unmatched-signups/route.js", ["STUDENTS_READ", "STUDENTS_WRITE", "BILLING_WRITE"]],
    ["app/api/admin/profile-requests/route.js", ["STUDENTS_READ", "MEMBERSHIPS_WRITE"]],
    ["app/api/questions/route.js", ["COMMUNICATIONS_READ", "COMMUNICATIONS_WRITE"]],
  ]);

  for (const [file, capabilities] of expected) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /authorizeStaffRequest/, `${file} must use named staff authorization`);
    assert.doesNotMatch(source, /validateStaffRequest/, `${file} must not accept every authenticated staff account`);
    for (const capability of capabilities) {
      assert.match(source, new RegExp(`STAFF_CAPABILITIES\\.${capability}\\b`), `${file} must require ${capability}`);
    }
  }

  const unmatched = readFileSync("app/api/admin/students/unmatched-signups/route.js", "utf8");
  assert.match(
    unmatched,
    /authorizeStaffRequest\(req,\s*\[\s*STAFF_CAPABILITIES\.STUDENTS_WRITE,\s*STAFF_CAPABILITIES\.BILLING_WRITE,/s,
    "signup conversion must require both student-write and billing-write authority",
  );

  for (const file of routeFilesUnder(path.resolve("app", "api", "admin"))) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /validateStaffRequest/,
      `${path.relative(process.cwd(), file)} must not bypass the capability contract`,
    );
  }
});

test("director keeps wildcard authority while sponsor and program staff stay bounded", () => {
  const source = readFileSync("lib/staffCapabilities.js", "utf8");
  assert.match(source, /director:\s*\["\*"\]/);
  assert.match(source, /sponsor_lead:\s*\["sponsorship\.read",\s*"sponsorship\.write"\]/);
  const programStaff = source.match(/program_staff:\s*\[([\s\S]*?)\],/i)?.[1] || "";
  assert.doesNotMatch(programStaff, /communications\.|system\.data_inventory|billing\./);
  assert.match(source, /required\.every\(\(item\) => capabilities\.includes\(item\)\)/);
});

test("staff command center hides work outside the signed-in role", () => {
  const source = readFileSync("app/admin/page.jsx", "utf8");
  assert.match(source, /staffHasCapability\(session, link\.capability\)/);
  for (const capability of ["STUDENTS_READ", "BILLING_READ", "ASSETS_READ", "COMMUNICATIONS_READ", "SPONSORSHIP_READ", "SYSTEM_DATA_INVENTORY_READ"]) {
    assert.match(source, new RegExp(`STAFF_CAPABILITIES\\.${capability}\\b`));
  }
});

test("new security-definer operations are private to the service role", () => {
  for (const name of [
    "set_student_form_requirement_state",
    "assign_requested_instrument",
    "apply_asset_import_transaction",
    "create_fee_charges_with_audit",
    "update_fee_charge_with_audit",
    "record_fee_payment_with_audit",
    "update_fee_payment_with_audit",
    "settle_online_fee_payment_with_audit",
  ]) {
    assert.match(migrations, new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\(`));
    assert.match(migrations, new RegExp(`${name}\\([^;]+\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`));
    assert.match(migrations, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\([^;]+\\)\\s+to\\s+service_role`));
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

test("production publishable key cannot execute protected mutations", {
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
    ["set_student_form_requirement_state", { p_requirement_id: "00000000-0000-0000-0000-000000000000", p_student_id: "00000000-0000-0000-0000-000000000000", p_state: "complete", p_completion_mode: "staff_record", p_next_action: "", p_note_summary: "", p_actor_staff_id: "00000000-0000-0000-0000-000000000000" }],
    ["assign_requested_instrument", { p_asset_id: "00000000-0000-0000-0000-000000000000", p_student_id: "00000000-0000-0000-0000-000000000000", p_request_id: "00000000-0000-0000-0000-000000000000", p_actor_person_id: "00000000-0000-0000-0000-000000000000", p_actor_staff_id: null, p_source: "test", p_condition: "", p_notes: "" }],
    ["apply_asset_import_transaction", { p_run_id: "00000000-0000-0000-0000-000000000000", p_assets: [], p_instruments: [], p_locks: [], p_lock_secrets: [], p_assignments: [], p_issues: [] }],
    ["create_fee_charges_with_audit", { p_student_ids: ["00000000-0000-0000-0000-000000000000"], p_category: "test", p_label: "test", p_amount_cents: 100, p_source: "manual", p_kind: "fee", p_created_by: "test", p_notes: "", p_actor_staff_id: "00000000-0000-0000-0000-000000000000", p_route: "test" }],
    ["record_fee_payment_with_audit", { p_student_id: "00000000-0000-0000-0000-000000000000", p_amount_cents: 100, p_method: "cash", p_category: "test", p_kind: "fee", p_invoice_id: "test", p_recorded_by: "test", p_received_at: new Date(0).toISOString(), p_payer_name: "", p_check_number: "", p_notes: "", p_actor_staff_id: "00000000-0000-0000-0000-000000000000", p_route: "test" }],
    ["settle_online_fee_payment_with_audit", { p_payment_id: "00000000-0000-0000-0000-000000000000", p_capture_id: "test", p_actor_type: "system", p_actor_id: "test", p_actor_name: "test", p_route: "test" }],
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
