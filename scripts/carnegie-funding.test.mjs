import test from "node:test";
import assert from "node:assert/strict";
import { allFundingRows, reconcileCarnegieFunding, usdCents } from "../lib/carnegieFunding.mjs";

const usd = value => ({ currency_code: "USD", value });
const payment = (changes = {}) => ({ amount_cents: 10000, category: "carnegie_2027_conditional_deposit", kind: "fee", status: "completed", method: "paypal", invoice_id: "synthetic-invoice", paypal_capture_id: "synthetic-capture", paypal_order_id: "synthetic-order", received_at: "2026-01-01", ...changes });
const capture = (changes = {}) => ({ id: "synthetic-capture", invoice_id: "synthetic-invoice", status: "COMPLETED", amount: usd("100.00"), seller_receivable_breakdown: { gross_amount: usd("100.00"), paypal_fee: usd("3.98"), net_amount: usd("96.02") }, ...changes });
const reader = (data = capture(), refunds = []) => ({ capture: async () => data, refunds: async () => refunds });
const refund = (gross, fee, net) => ({ id: "synthetic-refund", status: "COMPLETED", amount: usd(gross), seller_payable_breakdown: { gross_amount: usd(gross), paypal_fee: usd(fee), net_amount: usd(net) } });

test("actual fees, received cash and campaign gifts; no pending, credit, general or unrelated receipts", async () => {
  const result = await reconcileCarnegieFunding([
    payment(), payment({ method: "cash" }), payment({ method: "credit" }),
    payment({ status: "pending" }), payment({ category: "marching_band_2026" })
  ], [
    payment({ campaign_code: "general", status: "confirmed", method: "check" }),
    payment({ campaign_code: "carnegie-2027", status: "confirmed", method: "check" })
  ], reader());
  assert.equal(result.netCents, 29602);
  assert.equal(result.goalCents, 25000000);
  assert.equal(result.milestoneCents, 2500000);
  assert.deepEqual(Object.keys(result).sort(), ["checkedAt", "goalCents", "milestoneCents", "netCents"]);
});

test("refunded principal leaves actual retained processor fee deducted", async () => {
  const result = await reconcileCarnegieFunding([payment({ status: "refunded" })], [], reader(capture({ status: "REFUNDED" }), [refund("100.00", "0.00", "100.00")]));
  assert.equal(result.netCents, -398);
});

test("partial refund subtracts actual debit and respects returned fee", async () => {
  const result = await reconcileCarnegieFunding([payment()], [], reader(capture({ status: "PARTIALLY_REFUNDED" }), [refund("50.00", "1.50", "48.50")]));
  assert.equal(result.netCents, 4752);
});

test("fails closed for missing fees, duplicate captures, mismatched identity, missing refunds and unsettled money", async () => {
  for (const c of [capture({ seller_receivable_breakdown: {} }), capture({ id: "different" }), capture({ invoice_id: "different" }), capture({ status: "PENDING" }), capture({ status: "REFUNDED" })]) {
    await assert.rejects(reconcileCarnegieFunding([payment()], [], reader(c)));
  }
  await assert.rejects(reconcileCarnegieFunding([payment(), payment()], [], reader()));
  await assert.rejects(reconcileCarnegieFunding([payment({ status: "refunded" })], [], reader()));
  await assert.rejects(reconcileCarnegieFunding([payment({ method: "cash", received_at: null })], [], reader()));
  await assert.rejects(reconcileCarnegieFunding([payment()], [], { capture: async () => { throw new Error("Unavailable"); } }));
});

test("zero is valid only for a successfully read empty ledger; currency is strict", async () => {
  assert.equal((await reconcileCarnegieFunding([], [], reader())).netCents, 0);
  for (const money of [null, usd(""), usd("NaN"), { currency_code: "EUR", value: "10.00" }]) assert.throws(() => usdCents(money));
});

test("pagination does not silently truncate receipts", async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const all = await allFundingRows(async (start, end) => ({ data: source.slice(start, end + 1) }));
  assert.equal(all.length, 1201);
  await assert.rejects(allFundingRows(async () => ({ error: { message: "Unavailable" } })));
});
