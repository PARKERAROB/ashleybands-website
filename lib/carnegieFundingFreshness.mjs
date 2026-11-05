// Oldest verified total the public endpoint may publish.
export const CARNEGIE_FUNDING_MAX_AGE_MS = 300000;

// The shared cache serves a stale entry while it revalidates in the background. After idle time
// that entry is too old to publish, so verify now instead of withholding the total.
export async function currentCarnegieFunding(readCached, verifyNow, now = Date.now) {
  const entry = await readCached();
  if (entry && now() - entry.verifiedAt <= CARNEGIE_FUNDING_MAX_AGE_MS) return entry.funding;
  return verifyNow();
}

// Concurrent callers share one in-flight run instead of each starting their own processor
// reconciliation; the next call after it settles starts a new run.
export function singleFlight(run) {
  let inFlight = null;
  return () => {
    inFlight ||= Promise.resolve().then(run).finally(() => { inFlight = null; });
    return inFlight;
  };
}

// A short processor or ledger outage may serve the last fully verified total, up to this age (#257).
// Accounting failures never do. The route refuses anything older.
export const CARNEGIE_FUNDING_OUTAGE_GRACE_MS = 900000;

const OUTAGE_REASONS = new Set(["Processor reconciliation unavailable", "Funding ledger unavailable"]);

// Unreachable, not wrong: a timeout, a network failure, a processor 5xx/429 or a failed sign-in.
export function isFundingOutage(error) {
  return OUTAGE_REASONS.has(error?.message)
    || ["AbortError", "TimeoutError"].includes(error?.name)
    || (error instanceof TypeError && /fetch failed/i.test(error.message))
    || /^PayPal auth failed \((?:5\d\d|408|429)\)/.test(error?.message || "");
}

// Wraps a verification that throws. Remembers this instance's last verified total; during an outage
// returns it while it is within the grace window. An accounting failure forgets it and rethrows.
export function outageTolerant(verify, { now = Date.now, onFallback = () => {} } = {}) {
  let lastVerified = null;
  return async () => {
    try {
      lastVerified = await verify();
      return lastVerified;
    } catch (error) {
      if (!isFundingOutage(error)) {
        lastVerified = null;
        throw error;
      }
      if (lastVerified && now() - Date.parse(lastVerified.checkedAt) <= CARNEGIE_FUNDING_OUTAGE_GRACE_MS) {
        onFallback(error);
        return lastVerified;
      }
      throw error;
    }
  };
}

// Pages keep a total already on screen through a failed refresh while it is within the grace window.
export function keepShownFunding(shown, now = Date.now()) {
  return shown && now - Date.parse(shown.checkedAt) <= CARNEGIE_FUNDING_OUTAGE_GRACE_MS ? shown : null;
}
