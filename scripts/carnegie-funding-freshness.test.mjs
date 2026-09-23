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
