import test from "node:test";
import assert from "node:assert/strict";
import { CARNEGIE_FUNDING_MAX_AGE_MS, currentCarnegieFunding } from "../lib/carnegieFundingFreshness.mjs";

const NOW = Date.parse("2026-01-01T12:00:00Z");
const STALE = CARNEGIE_FUNDING_MAX_AGE_MS + 1;
const cachedTotal = { netCents: 100, checkedAt: "cached" };
const verifiedTotal = { netCents: 200, checkedAt: "verified" };

// Returns what the endpoint would publish and how many fresh verifications ran.
async function read(entry, verified = verifiedTotal) {
  let verifications = 0;
  const result = await currentCarnegieFunding(async () => entry,
    async () => { verifications += 1; return verified; }, () => NOW);
  return { result, verifications };
}
const cached = (funding, ageMs) => ({ funding, verifiedAt: NOW - ageMs });

test("a fresh cached total is served without a new verification", async () => {
  assert.deepEqual(await read(cached(cachedTotal, 60000)), { result: cachedTotal, verifications: 0 });
  assert.deepEqual(await read(cached(cachedTotal, CARNEGIE_FUNDING_MAX_AGE_MS)), { result: cachedTotal, verifications: 0 });
});

test("a stale cached total after idle is verified now instead of withheld", async () => {
  assert.deepEqual(await read(cached(cachedTotal, STALE)), { result: verifiedTotal, verifications: 1 });
});

test("a fresh cached failure stays unavailable without re-verifying", async () => {
  assert.deepEqual(await read(cached(null, 30000)), { result: null, verifications: 0 });
});

test("a stale cached failure is re-verified; a failed verification stays unavailable", async () => {
  assert.deepEqual(await read(cached(null, STALE)), { result: verifiedTotal, verifications: 1 });
  assert.deepEqual(await read(cached(cachedTotal, STALE), null), { result: null, verifications: 1 });
});

test("a missing cache entry is verified now", async () => {
  assert.deepEqual(await read(undefined), { result: verifiedTotal, verifications: 1 });
});

// #257: ride out short processor or ledger outages; never mask an accounting failure.
const { CARNEGIE_FUNDING_OUTAGE_GRACE_MS, isFundingOutage, outageTolerant, keepShownFunding } =
  await import("../lib/carnegieFundingFreshness.mjs");

function sequence(...steps) {
  let i = 0;
  return async () => { const step = steps[i++]; if (step instanceof Error) throw step; return step; };
}
const verifiedAt = (ms) => ({ netCents: 500, checkedAt: new Date(NOW - ms).toISOString() });
const outage = new Error("Processor reconciliation unavailable");
const mismatch = new Error("Capture identity mismatch");

test("outages are told apart from accounting failures", () => {
  assert.equal(isFundingOutage(outage), true);
  assert.equal(isFundingOutage(new Error("Funding ledger unavailable")), true);
  assert.equal(isFundingOutage(Object.assign(new Error("x"), { name: "TimeoutError" })), true);
  assert.equal(isFundingOutage(new TypeError("fetch failed")), true);
  assert.equal(isFundingOutage(new Error("PayPal auth failed (503): ")), true);
  assert.equal(isFundingOutage(new Error("PayPal auth failed (401): bad")), false);
  assert.equal(isFundingOutage(new Error("Processor reconciliation refused")), false);
  assert.equal(isFundingOutage(mismatch), false);
  assert.equal(isFundingOutage(undefined), false);
});

test("an outage within the grace window serves the last verified total", async () => {
  const total = verifiedAt(CARNEGIE_FUNDING_OUTAGE_GRACE_MS);
  let fallbacks = 0;
  const read = outageTolerant(sequence(total, outage), { now: () => NOW, onFallback: () => { fallbacks += 1; } });
  assert.equal(await read(), total);
  assert.equal(await read(), total);
  assert.equal(fallbacks, 1);
});

test("an outage past the grace window, or with nothing verified yet, stays unavailable", async () => {
  const old = outageTolerant(sequence(verifiedAt(CARNEGIE_FUNDING_OUTAGE_GRACE_MS + 1), outage), { now: () => NOW });
  await old();
  await assert.rejects(old(), outage);
  await assert.rejects(outageTolerant(sequence(outage), { now: () => NOW })(), outage);
});

test("an accounting failure is never masked and forgets the last total", async () => {
  const read = outageTolerant(sequence(verifiedAt(0), mismatch, outage), { now: () => NOW });
  await read();
  await assert.rejects(read(), mismatch);
  await assert.rejects(read(), outage);
});

test("a page keeps a shown total through a failed refresh only within the grace window", () => {
  const fresh = verifiedAt(CARNEGIE_FUNDING_OUTAGE_GRACE_MS);
  assert.equal(keepShownFunding(fresh, NOW), fresh);
  assert.equal(keepShownFunding(verifiedAt(CARNEGIE_FUNDING_OUTAGE_GRACE_MS + 1), NOW), null);
  assert.equal(keepShownFunding(null, NOW), null);
});
