// Oldest verified total the public endpoint may publish.
export const CARNEGIE_FUNDING_MAX_AGE_MS = 300000;

// The shared cache serves a stale entry while it revalidates in the background. After idle time
// that entry is too old to publish, so verify now instead of withholding the total.
export async function currentCarnegieFunding(readCached, verifyNow, now = Date.now) {
  const entry = await readCached();
  if (entry && now() - entry.verifiedAt <= CARNEGIE_FUNDING_MAX_AGE_MS) return entry.funding;
  return verifyNow();
}
