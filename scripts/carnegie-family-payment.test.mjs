import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeGiftPurpose, FAMILY_PAYMENT, CARNEGIE_SUGGESTED_AMOUNTS } from "../lib/sponsorCampaigns.mjs";

test("a family payment is a Carnegie-only gift kind (#228)", () => {
  assert.deepEqual(normalizeGiftPurpose({ campaign_code: "carnegie-2027", gift_kind: FAMILY_PAYMENT }), { campaignCode: "carnegie-2027", giftKind: FAMILY_PAYMENT });
  assert.throws(() => normalizeGiftPurpose({ campaign_code: "general", gift_kind: FAMILY_PAYMENT }), /Carnegie trip only/);
  assert.ok(CARNEGIE_SUGGESTED_AMOUNTS[FAMILY_PAYMENT].length);
});

test("a family payment needs a credited student", () => {
  const gifts = readFileSync("lib/sponsorGifts.js", "utf8");
  assert.match(gifts, /purpose\.giftKind === FAMILY_PAYMENT && !targets\.portalStudentId/);
});

test("the receipt is a payment receipt with no tax-deductible claim, and is never listed", () => {
  const src = readFileSync("lib/sponsorRecognition.js", "utf8");
  const body = src.slice(src.indexOf("function familyPaymentReceipt"), src.indexOf("// Confirm a gift and fire Lane A."));
  assert.match(body, /payment receipt/);
  assert.match(body, /FAMILY_PAYMENT_TAX_LINE/);
  assert.doesNotMatch(body, /Eligible charitable contribution|tax-deductible portion|501\(c\)\(3\)/i);
  assert.match(src, /\["donation", FAMILY_PAYMENT\]\.includes\(gift\.gift_kind\)\) listOnSite = false/);
  assert.match(src, /deductible_cents: gift\.gift_kind === FAMILY_PAYMENT \? 0 : deductibleCents/);
});

test("the choice appears only on a student's link", () => {
  const form = readFileSync("app/sponsors/give/GiveClient.jsx", "utf8");
  assert.match(form, /\{studentFirst \? <label><input type="radio" name="gift-kind" value=\{FAMILY_PAYMENT\}/);
  assert.match(form, /familyPayment \? FAMILY_PAYMENT_TAX_LINE : BOOSTER_NONPROFIT_COPY/);
});

test("a guardian the portal shows a student to can see and pay that student's account (#241)", async () => {
  // Shape of the reported case: a trusted guardian link imported at legacy assurance.
  const { familyEligibleLink, FAMILY_GUARDIAN_ASSURANCE } = await import("../lib/familyAccess.mjs");
  const link = (person_type, assurance_level) => ({ student_id: "s", assurance_level, portal_people: { person_type } });
  assert.equal(familyEligibleLink(link("guardian", "legacy")), true, "legacy guardian sees Payments");
  assert.equal(familyEligibleLink(link("student", "legacy")), false, "a student's own record still needs high");
  assert.deepEqual([...FAMILY_GUARDIAN_ASSURANCE], ["legacy", "medium", "high"]);

  const billing = readFileSync("lib/billing.js", "utf8");
  assert.match(billing, /\.filter\(familyEligibleLink\)/, "trustedStudentIds uses the family rule");
  assert.match(billing, /\.in\("assurance_level", FAMILY_GUARDIAN_ASSURANCE\)/, "isTrustedGuardian uses the family rule");
  assert.doesNotMatch(billing, /\["medium", "high"\]/, "billing has no stricter guardian rule of its own");

  const client = readFileSync("app/portal/review/PortalReviewClient.jsx", "utf8");
  const section = client.slice(client.indexOf("function BillingSection"), client.indexOf("function StudentFeeCard"));
  assert.match(section, /data && !student \?/, "a connection with no billing record is told so, not 'Nothing is due'");
});
