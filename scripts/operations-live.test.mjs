import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/202608300007_operations_assets_forms_financial.sql");
const financial = read("lib/financialOperations.js");
const forms = read("lib/formOperations.js");
const student360 = read("app/admin/students/CurrentStudentsWorkspace.jsx");
const commandCenter = read("app/admin/page.jsx");
const instrumentPortal = read("app/api/portal/instrument-request/route.js");
const staffAuth = read("app/api/sponsors/staff-auth/route.js");
const assetImporter = read("scripts/sync-assets.mjs");
const familyBilling = read("app/api/billing/me/route.js");
const familyReview = read("app/portal/review/PortalReviewClient.jsx");
const familyCapture = read("app/api/billing/capture-order/route.js");
const billingWebhook = read("app/api/billing/webhook/route.js");

test("operations migration establishes normalized assets, forms, and separated finance views", () => {
  for (const table of [
    "assets", "asset_instruments", "asset_assignments", "asset_events", "asset_lock_secrets",
    "form_definitions", "form_versions", "form_requirements", "student_form_requirements", "form_requirement_events",
  ]) assert.match(migration, new RegExp(`create table if not exists public\\.${table}\\b`));
  assert.match(migration, /create or replace view public\.student_program_fee_summary/);
  assert.match(migration, /create or replace view public\.student_campaign_summary/);
  assert.match(migration, /kind = 'funding_goal'/);
  assert.match(migration, /from public\.sponsor_gifts/);
  assert.match(migration, /legacy_sponsorship_credit_cents/);
  assert.match(migration, /fee_payments add column if not exists kind/);
  assert.match(migration, /check \(role in \('director','sponsor_lead','program_staff'\)\)/);
});

test("financial operations default to active students and do not double-count legacy gifts", () => {
  assert.match(financial, /\.eq\("status", "active"\)/);
  assert.match(financial, /const campaignRaisedCents = campaignContributionCents \+ confirmedGiftCents/);
  assert.doesNotMatch(financial, /campaignRaisedCents = .*legacySponsorshipCreditCents/);
  assert.match(financial, /feeCharges = .*&& !isCampaign/);
  assert.match(familyBilling, /category: c\.category/);
  assert.match(familyReview, /feeCategories\[0\]/);
  assert.match(migration, /create or replace function public\.settle_online_fee_payment_with_audit\(/);
  assert.match(familyCapture, /detail\.invoiceId !== payment\.invoice_id/);
  assert.match(familyCapture, /detail\.currencyCode !== "USD"/);
  assert.match(familyCapture, /settle_online_fee_payment_with_audit/);
  assert.match(billingWebhook, /PayPal family capture does not match the stored fee payment/);
});

test("forms expand only real connected workflows", () => {
  assert.match(forms, /career-onboarding/);
  assert.match(forms, /county-instrument-agreement/);
  assert.match(forms, /portal_onboarding_completions/);
  assert.match(forms, /portal_instrument_requests/);
  assert.match(forms, /instrument_access === "school"/);
  assert.match(forms, /\.order\("last_confirmed_at", \{ ascending: false \}\)/);
  assert.doesNotMatch(forms, /medical form/i);
});

test("command center and Student 360 link to the live connected workspaces", () => {
  for (const href of ["/admin/financial", "/admin/forms", "/admin/assets"]) {
    assert.match(commandCenter, new RegExp(href.replaceAll("/", "\\/")));
    assert.match(student360, new RegExp(href.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(student360, /Catalog not connected/);
  assert.doesNotMatch(student360, /operations-prototype\?area=forms/);
});

test("instrument issue is atomic and guardian agreement requires verified guardian authority", () => {
  assert.match(instrumentPortal, /assign_requested_instrument/);
  assert.match(instrumentPortal, /portal_students\.status", "active"/);
  assert.match(instrumentPortal, /person_type !== "guardian"/);
  assert.match(instrumentPortal, /\["medium", "high"\]\.includes\(link\.assurance_level\)/);
  assert.doesNotMatch(instrumentPortal, /\.from\("instrument_inventory"\)\s*\.insert/);
  assert.match(migration, /active student required/);
  assert.match(migration, /exactly one assignment actor is required/);
});

test("staff sign-in never returns a database session token to browser JavaScript", () => {
  assert.match(staffAuth, /temporarily unavailable/);
  assert.doesNotMatch(staffAuth, /payload\.token\s*=/);
});

test("asset apply publishes through one service-only database transaction", () => {
  assert.match(migration, /create or replace function public\.apply_asset_import_transaction\(/);
  assert.match(migration, /for update;[\s\S]*on conflict \(source_system, source_key\) do update/);
  assert.match(migration, /insert into asset_lock_secrets[\s\S]*insert into asset_assignments/);
  assert.match(migration, /insert into asset_import_issues[\s\S]*update asset_import_runs set[\s\S]*status = 'complete'/);
  assert.match(migration, /revoke all on function public\.apply_asset_import_transaction\([^;]+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.apply_asset_import_transaction\([^;]+to service_role/);
  assert.match(assetImporter, /supabase\.rpc\(\s*"apply_asset_import_transaction"/);
  assert.doesNotMatch(assetImporter, /\.from\("assets"\)\.upsert/);
  assert.doesNotMatch(assetImporter, /\.from\("asset_assignments"\)\.insert/);
});
