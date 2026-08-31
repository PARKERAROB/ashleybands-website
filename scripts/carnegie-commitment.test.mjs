import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("serious family intent creates the fixed charge in the existing ledger", () => {
  const migration = read("supabase/migrations/202608310001_carnegie_commitment.sql");
  assert.match(migration, /insert into fee_charges/);
  assert.match(migration, /'carnegie_2027_conditional_deposit'.*'Carnegie Hall conditional deposit'/s);
  assert.match(migration, /5000, 'active'/);
  assert.match(migration, /p_response = 'serious_yes'/);
});

test("public intake matches exact student identity without returning the roster", () => {
  const route = read("app/api/carnegie-2027/commitment/route.js");
  const model = read("lib/carnegieTrip.js");
  assert.match(route, /findCarnegieStudentFromPublicIdentity/);
  assert.match(route, /carnegie-commitment-identity/);
  assert.match(model, /email\.endsWith\("@student\.nhcs\.net"\)/);
  assert.match(model, /normalizedName\(data\.legal_last\) !== last/);
  assert.doesNotMatch(route, /students:\s*rows/);
});

test("capture settlement verifies the fixed amount and uses the shared audit ledger RPC", () => {
  const route = read("app/api/carnegie-2027/payment/capture/route.js");
  assert.match(route, /CARNEGIE_DEPOSIT_CENTS/);
  assert.match(route, /detail\.currencyCode !== "USD"/);
  assert.match(route, /settle_online_fee_payment_with_audit/);
  assert.match(route, /payment\.category !== CARNEGIE_DEPOSIT_CATEGORY/);
});

test("staff verbal fallback remains unsigned, unpaid, and queued for login help", () => {
  const migration = read("supabase/migrations/202608310001_carnegie_commitment.sql");
  const workspace = read("app/admin/carnegie-2027/CarnegieTripWorkspace.jsx");
  assert.match(migration, /p_source = 'staff_verbal' then null/);
  assert.match(migration, /p_source = 'staff_verbal' then 'login_help'/);
  assert.match(workspace, /does not mark payment received/);
  assert.match(workspace, /Unsigned verbal record/);
});

test("refund path reaches PayPal before reconciling the internal ledger", () => {
  const route = read("app/api/admin/carnegie-2027/route.js");
  const paypal = read("lib/paypal.js");
  assert.ok(route.indexOf("await refundCapture") < route.indexOf('rpc("settle_online_fee_refund_with_audit"'));
  assert.match(paypal, /v2\/payments\/captures\/\$\{encodeURIComponent\(captureId\)\}\/refund/);
});

test("meeting deadline slide carries the live commitment QR target", () => {
  const slides = read("app/meetings/2026-09-01/slides.js");
  const deck = read("app/meetings/2026-09-01/BoosterMeetingDeck.jsx");
  assert.match(slides, /https:\/\/ashleybands\.com\/carnegie-2027\/commit/);
  assert.match(deck, /Scan to commit and pay/);
  assert.match(deck, /QRCodeSVG value=\{slide\.url\}/);
});
