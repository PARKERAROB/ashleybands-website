import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  giftInvoiceIdForRequest,
  initialSponsorListingState,
  isSponsorInvoiceId,
  legacySponsorPinEnabled,
  normalizePublicGiftInput,
  paypalCaptureMatchesGift,
  reconcileGiftAttribution,
  sponsorThankYouLine,
  webhookSettlementPlan
} from "../lib/sponsorGiftPolicy.mjs";
import {
  signSponsorGiveToken,
  verifySponsorGiveToken
} from "../lib/sponsorGiveToken.mjs";

const REQUEST_KEY = "61fe02d8-66a7-4cbb-adc6-dcaba8f7d7a9";
const source = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("the give page thanks the sponsor for supporting Ashley Bands", () => {
  assert.equal(
    sponsorThankYouLine("Cypress Pointe Rehabilitation"),
    "Thank you, Cypress Pointe Rehabilitation, for supporting the Bands of Ashley."
  );
});

test("legacy PIN access and automatic public listing stay closed by default", () => {
  assert.equal(legacySponsorPinEnabled(undefined), false);
  assert.equal(legacySponsorPinEnabled("false"), false);
  assert.equal(legacySponsorPinEnabled("true"), true);
  assert.equal(initialSponsorListingState(), false);
});

test("public gift input requires a reusable request key and valid bounded fields", () => {
  assert.deepEqual(
    normalizePublicGiftInput({
      request_key: REQUEST_KEY,
      business_name: "  Example Business  ",
      payer_name: "  Pat Person  ",
      payer_email: "PAT@EXAMPLE.COM"
    }),
    {
      requestKey: REQUEST_KEY,
      businessName: "Example Business",
      payerName: "Pat Person",
      payerEmail: "pat@example.com"
    }
  );
  assert.throws(
    () => normalizePublicGiftInput({ request_key: "not-a-uuid", business_name: "Example" }),
    /start this gift again/i
  );
  assert.throws(
    () => normalizePublicGiftInput({ request_key: REQUEST_KEY, business_name: "x".repeat(161) }),
    /business name/i
  );
  assert.throws(
    () => normalizePublicGiftInput({ request_key: REQUEST_KEY, business_name: "Example", payer_email: "bad" }),
    /valid email/i
  );
});

test("one browser request key always maps to one sponsorship invoice", () => {
  const first = giftInvoiceIdForRequest(REQUEST_KEY);
  const second = giftInvoiceIdForRequest(REQUEST_KEY);
  assert.equal(first, second);
  assert.match(first, /^AB-SP-[A-F0-9]{20}$/);
});

test("signed attribution cannot be changed to another business or prospect", () => {
  const canonical = reconcileGiftAttribution({
    tokenClaims: { businessId: "business-1", prospectId: "prospect-1" },
    prospect: { id: "prospect-1", business_id: "business-1", family_id: "family-1" },
    business: { id: "business-1", name_display: "Canonical Business" }
  });
  assert.deepEqual(canonical, {
    businessId: "business-1",
    prospectId: "prospect-1",
    familyId: "family-1",
    businessName: "Canonical Business"
  });

  assert.throws(
    () => reconcileGiftAttribution({
      tokenClaims: { businessId: "business-2", prospectId: "prospect-1" },
      prospect: { id: "prospect-1", business_id: "business-1", family_id: "family-1" },
      business: { id: "business-2", name_display: "Wrong Business" }
    }),
    /does not match/i
  );
});

test("sponsor give attribution tokens are signed and expire", () => {
  const secret = "test-sponsorship-secret-with-enough-entropy";
  const token = signSponsorGiveToken(
    { businessId: "business-1", prospectId: "prospect-1" },
    { secret, nowMs: 1_000, ttlMs: 5_000 }
  );
  assert.deepEqual(
    verifySponsorGiveToken(token, { secret, nowMs: 2_000 }),
    { businessId: "business-1", prospectId: "prospect-1" }
  );
  assert.equal(verifySponsorGiveToken(`${token}x`, { secret, nowMs: 2_000 }), null);
  assert.equal(verifySponsorGiveToken(token, { secret, nowMs: 7_000 }), null);
});

test("PayPal webhooks route sponsor invoices to the sponsor ledger", () => {
  assert.equal(isSponsorInvoiceId("AB-SP-123"), true);
  assert.deepEqual(
    webhookSettlementPlan("PAYMENT.CAPTURE.COMPLETED", "AB-SP-123"),
    { ledger: "sponsor", status: "confirmed" }
  );
  assert.deepEqual(
    webhookSettlementPlan("PAYMENT.CAPTURE.REFUNDED", "AB-SP-123"),
    { ledger: "sponsor", status: "refunded" }
  );
  assert.deepEqual(
    webhookSettlementPlan("PAYMENT.CAPTURE.COMPLETED", "AHS-FEE-123"),
    { ledger: "family", status: "completed" }
  );
});

test("PayPal capture identity, invoice, and amount must all match the gift", () => {
  const gift = { id: "gift-1", invoice_id: "AB-SP-123", amount_cents: 50000 };
  const capture = { customId: "gift-1", invoiceId: "AB-SP-123", amountValue: "500.00" };
  const cents = (value) => Math.round(Number(value) * 100);
  assert.equal(paypalCaptureMatchesGift(capture, gift, cents), true);
  assert.equal(paypalCaptureMatchesGift({ ...capture, amountValue: "5.00" }, gift, cents), false);
  assert.equal(paypalCaptureMatchesGift({ ...capture, customId: "gift-2" }, gift, cents), false);
});

test("legacy tracker and PIN signup cannot bypass the Family Portal", () => {
  assert.match(source("app/sponsors/tracker/page.jsx"), /redirect\("\/portal\/sponsorship"\)/);
  assert.match(source("app/api/sponsors/family-auth/route.js"), /if \(!sponsorLegacyPinLive\(\)\)/);
  assert.match(source("lib/sponsorFamily.js"), /if \(sponsorLegacyPinLive\(\)\)/);
});

test("public gift writes use signed attribution, idempotency, and fail-closed rate limits", () => {
  for (const path of [
    "app/api/sponsors/give/check/route.js",
    "app/api/sponsors/give/create-order/route.js"
  ]) {
    const route = source(path);
    assert.match(route, /normalizePublicGiftInput/);
    assert.match(route, /attributionToken/);
    assert.match(route, /failOpen: false/);
    assert.doesNotMatch(route, /body\.business_id|body\.prospect_id/);
  }
});

test("online gifts stay private until staff review and badges require a listed gift", () => {
  assert.match(source("app/api/sponsors/give/capture-order/route.js"), /listOnSite: false/);
  assert.match(source("app/api/sponsors/badge/route.js"), /\.eq\("listed_on_site", true\)/);
  assert.match(source("app/api/sponsors/gifts/[id]/route.js"), /body\.action === "list"/);
});

test("the PayPal webhook settles and refunds the sponsor ledger", () => {
  const route = source("app/api/billing/webhook/route.js");
  assert.match(route, /settleSponsorCapture/);
  assert.match(route, /refundSponsorGift/);
  assert.match(route, /confirmGift/);
});
