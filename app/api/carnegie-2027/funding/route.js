import { getCarnegieFunding } from "@/lib/carnegieFundingServer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const funding = await getCarnegieFunding();
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!funding || Date.now() - Date.parse(funding.checkedAt) > 300000) {
    return Response.json({ unavailable: true }, { status: 503, headers });
  }
  return Response.json(funding, { headers });
}
