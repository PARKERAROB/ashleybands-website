import { getCarnegieFunding } from "@/lib/carnegieFundingServer";
import { CARNEGIE_FUNDING_MAX_AGE_MS } from "@/lib/carnegieFundingFreshness.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const funding = await getCarnegieFunding();
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!funding || Date.now() - Date.parse(funding.checkedAt) > CARNEGIE_FUNDING_MAX_AGE_MS) {
    return Response.json({ unavailable: true }, { status: 503, headers });
  }
  return Response.json(funding, { headers });
}
