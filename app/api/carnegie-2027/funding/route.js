import { getCarnegieFunding } from "@/lib/carnegieFundingServer";
import { CARNEGIE_FUNDING_OUTAGE_GRACE_MS } from "@/lib/carnegieFundingFreshness.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const funding = await getCarnegieFunding();
  // Normal serving is at most five minutes old (getCarnegieFunding); only an outage fallback reaches this ceiling (#257).
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!funding || Date.now() - Date.parse(funding.checkedAt) > CARNEGIE_FUNDING_OUTAGE_GRACE_MS) {
    return Response.json({ unavailable: true }, { status: 503, headers });
  }
  return Response.json(funding, { headers });
}
