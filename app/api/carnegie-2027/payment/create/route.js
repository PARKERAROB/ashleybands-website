import { NextResponse } from "next/server";
import { createCarnegiePaymentOrder } from "@/lib/carnegieTrip";
import { isPaypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isPaypalConfigured()) return NextResponse.json({ error: "Online payment is not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await createCarnegiePaymentOrder(String(body.checkoutToken || ""));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not start payment." }, { status: 409 });
  }
}
