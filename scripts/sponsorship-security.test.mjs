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
  signSponsorStudentGiveToken,
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

test("student share links use a distinct signed and expiring attribution token", () => {
  const secret = "test-sponsorship-secret-with-enough-entropy";
  const token = signSponsorStudentGiveToken(
    { linkId: "link-1", studentId: "student-1" },
    { secret, nowMs: 1_000, ttlMs: 5_000 }
  );
  assert.deepEqual(
    verifySponsorGiveToken(token, { secret, nowMs: 2_000 }),
    { linkId: "link-1", studentId: "student-1" }
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
    assert.doesNotMatch(route, /body\.portal_student_id|body\.student_id/);
  }
});

test("student support links are short, server-resolved, revocable, and walled", () => {
  const shortRoute = source("app/support/[code]/page.jsx");
  const resolver = source("lib/sponsorStudentLinks.js");
  const migration = source("supabase/migrations/0043_student_sponsorship_links.sql");

  assert.match(shortRoute, /resolveSponsorStudentCode/);
  assert.match(shortRoute, /signSponsorStudentGiveToken/);
  assert.match(resolver, /randomBytes\(9\)/);
  assert.match(resolver, /\.eq\("active", true\)|!link\.active/);
  assert.match(migration, /portal_student_id uuid not null/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /enable row level security/);
});

test("the donor page explains program support and student attribution without accepting a raw student id", () => {
  const givePage = source("app/sponsors/give/GiveClient.jsx");
  const gifts = source("lib/sponsorGifts.js");
  assert.match(givePage, /supports the whole Bands of Ashley program/);
  assert.match(givePage, /sponsorship total/);
  assert.match(gifts, /resolveSponsorStudentTokenClaims/);
  assert.doesNotMatch(givePage, /portal_student_id|student_id/);
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

test("manual reconciliation cannot turn an incomplete online checkout into received money", async () => {
  const { manualGiftConfirmationError } = await import("../lib/sponsorOperations.mjs");
  assert.match(manualGiftConfirmationError({ status: "pending", method: "online" }), /processor/);
  for (const method of ["check", "cash", "other"]) assert.equal(manualGiftConfirmationError({ status: "pending", method }), null);
  for (const status of ["confirmed", "refunded", "void"]) assert.ok(manualGiftConfirmationError({ status, method: "check" }));
  assert.ok(manualGiftConfirmationError(null));
  assert.ok(manualGiftConfirmationError({ status: "pending", method: "unknown" }));
});

test("sponsorship follow-up excludes unsettled money and distinguishes recognition from payment", async () => {
  const { sponsorshipSummary } = await import("../lib/sponsorOperations.mjs");
  const summary = sponsorshipSummary([
    { status: "confirmed", amount_cents: 25000, listed_on_site: false, recognition_status: "sent" },
    { status: "confirmed", amount_cents: 5000, listed_on_site: true, recognition_status: "failed" },
    { status: "pending", amount_cents: 99000, method: "online" },
    { status: "pending", amount_cents: 6000, method: "check" },
    { status: "void", amount_cents: 50000 },
    { status: "refunded", amount_cents: 10000 }
  ], [
    { campaign: "family-warm-request", send_status: "queued" },
    { campaign: "family-warm-request", send_status: "failed" },
    { campaign: "family-warm-request", send_status: "sent" },
    { campaign: "cold", send_status: "queued" }
  ]);
  assert.deepEqual(summary, { confirmedCount: 2, confirmedCents: 30000, offlinePending: 1, onlinePending: 1, recognitionReview: 1, receiptAttention: 1, badgeFollowUp: 1, introductionsQueued: 1, introductionsFailed: 1, outreachQueued: 2 });
});

test("badge drafts require confirmed published recognition and contain no student fields", async () => {
  const { recognitionDraft } = await import("../lib/sponsorOperations.mjs");
  for (const status of ["pending", "refunded", "void"]) assert.equal(recognitionDraft({ status, listed_on_site: true }), null);
  assert.equal(recognitionDraft({ status: "confirmed", listed_on_site: false }), null);
  const draft = recognitionDraft({ id: "sample-id", status: "confirmed", listed_on_site: true, business_name: "Example Sponsor", payer_email: "review@example.com", student: { display_name: "PRIVATE_STUDENT" } });
  assert.equal(draft.to, "review@example.com");
  assert.match(draft.text, /Example Sponsor/);
  assert.match(draft.badgeUrl, /id=sample-id$/);
  assert.doesNotMatch(JSON.stringify(draft), /PRIVATE_STUDENT/);
});

test("family introduction labels distinguish request, dispatch and failure", async () => {
  const { warmRequestLabel } = await import("../lib/sponsorOperations.mjs");
  assert.match(warmRequestLabel("queued"), /Waiting for staff/);
  assert.match(warmRequestLabel("sent"), /does not mean.*replied/);
  assert.match(warmRequestLabel("failed"), /could not be sent/);
  assert.match(warmRequestLabel(null), /No introduction email has been queued/);
});

test("outreach send requires the exact reviewed queue, including same-size substitutions", async () => {
  const { sameOutreachQueue } = await import("../lib/sponsorOperations.mjs");
  assert.equal(sameOutreachQueue(["a", "b"], ["b", "a"]), true);
  assert.equal(sameOutreachQueue(["a", "a"], ["a", "b"]), false);
  assert.equal(sameOutreachQueue(["a", "b"], ["a", "c"]), false);
  assert.equal(sameOutreachQueue(["a"], ["a", "b"]), false);
  assert.equal(sameOutreachQueue(undefined, ["a"]), false);
});

test("the general give form explains its purpose, level, and next steps (#125)", () => {
  const givePage = source("app/sponsors/give/GiveClient.jsx");
  assert.match(givePage, /Supports the Ashley band program: instructional staff, transportation, scholarships and instruments\./);
  assert.match(givePage, /matches the \{level\.name\} level/);
  assert.match(givePage, /Gifts under \$250 are donations and aren't a sponsorship level\./);
  assert.doesNotMatch(givePage, /: "500"\}/);
  assert.match(givePage, /This giving link has expired\. You can still give here\./);
  assert.match(givePage, /Online giving is temporarily unavailable\. Mail a check payable to/);
  assert.match(givePage, /Copy instructions/);
  assert.match(givePage, /serverMessage\.current \|\| PAY_FALLBACK_MESSAGE/, "createOrder server messages reach the donor");
  assert.doesNotMatch(givePage, /reconciling the receipt/);
  assert.match(source("app/api/sponsors/give/check/route.js"), /Attn: Band Director/);
  assert.match(source("app/sponsors/page.jsx"), /\/sponsors\/give\?amount=\$\{tier\.amount\}/);
  assert.doesNotMatch(source("app/sponsors/give/page.jsx"), /fallback=\{null\}/);
  // The live level hint uses the TIERS thresholds; they must stay in step with tierForAmount.
  const thresholds = [...source("lib/sponsorRecognition.js").matchAll(/if \(d >= (\d+)\) return "(\w+)"/g)].map(([, amount, name]) => [name, Number(amount)]);
  const tiers = source("lib/sponsorshipContent.js");
  for (const [name, amount] of thresholds) assert.match(tiers, new RegExp(`name: "${name}",\\s*amount: ${amount},`));
  assert.equal(thresholds.length, 5);
});
