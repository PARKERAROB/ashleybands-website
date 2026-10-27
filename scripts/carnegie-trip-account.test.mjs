import test from "node:test";
import assert from "node:assert/strict";
import { carnegieTripAccount } from "../lib/carnegieTripAccountMath.mjs";

test("deposit only: $600 still due toward the first payment", () => {
  const a = carnegieTripAccount({ familyPayments: [{ amountCents: 5000 }] });
  assert.equal(a.owedCents, 195000);
  assert.equal(a.firstPaymentOwedCents, 60000);
});

test("gifts for the student count toward the first payment", () => {
  const a = carnegieTripAccount({ gifts: [{ amountCents: 10000 }], familyPayments: [{ amountCents: 5000 }] });
  assert.equal(a.firstPaymentOwedCents, 50000);
  assert.equal(a.owedCents, 185000);
});

test("credit above the share goes back to the fund, never below zero", () => {
  const a = carnegieTripAccount({ gifts: [{ amountCents: 250000 }] });
  assert.equal(a.creditedCents, 200000);
  assert.equal(a.owedCents, 0);
  assert.equal(a.firstPaymentOwedCents, 0);
});

test("a not-yet gift stays off the student's account", () => {
  const a = carnegieTripAccount({ gifts: [{ amountCents: 200000, invoiceId: "AB-SP-ADF984C6FA7BAB491349" }] });
  assert.equal(a.giftCents, 0);
  assert.equal(a.owedCents, 200000);
});

import { paypalFeeCents, paypalGrossUpCents } from "../lib/carnegieTripAccountMath.mjs";

test("PayPal fee matches the band's captures", () => {
  assert.equal(paypalFeeCents(10000), 348);
  assert.equal(paypalFeeCents(50000), 1544);
});

test("covering the fee credits the full amount", () => {
  for (const net of [5000, 60000, 65000, 250000]) {
    const gross = paypalGrossUpCents(net);
    assert.ok(gross - paypalFeeCents(gross) >= net);
    assert.ok(gross - 1 - paypalFeeCents(gross - 1) < net);
  }
});
