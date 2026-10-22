import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { giftCreditedCents, notesDollars } from "../lib/carnegieLetters.mjs";
import { captureFeeCents } from "../lib/sponsorGiftPolicy.mjs";

test("music notes credit online gifts after PayPal's fee (#227)", () => {
  assert.equal(giftCreditedCents({ amount_cents: 10000, paypal_fee_cents: 348 }), 9652);
  assert.equal(giftCreditedCents({ amount_cents: 50000, paypal_fee_cents: null }), 50000, "check and cash have no fee");
  assert.equal(giftCreditedCents({ amount_cents: 100, paypal_fee_cents: 500 }), 0);
});

test("music notes show cents only when there are some", () => {
  assert.equal(notesDollars(132500), "$1,325");
  assert.equal(notesDollars(9652), "$96.52");
  assert.equal(notesDollars(0), "$0");
});

test("the capture fee is read from PayPal's USD breakdown, never defaulted to zero", () => {
  assert.equal(captureFeeCents({ feeValue: "3.48", feeCurrencyCode: "USD" }), 348);
  assert.equal(captureFeeCents({ feeValue: "", feeCurrencyCode: "" }), null);
  assert.equal(captureFeeCents({ feeValue: "3.48", feeCurrencyCode: "EUR" }), null);
});

test("both capture paths store the fee and the notes total uses it", () => {
  for (const path of ["app/api/sponsors/give/capture-order/route.js", "app/api/billing/webhook/route.js"]) {
    assert.match(readFileSync(path, "utf8"), /paypal_fee_cents: captureFeeCents\(capture\)/, path);
  }
  const server = readFileSync("lib/carnegieLettersServer.js", "utf8");
  assert.match(server, /select\("portal_student_id, amount_cents, paypal_fee_cents"\)/);
  assert.match(server, /giftCreditedCents\(gift\)/);
});
