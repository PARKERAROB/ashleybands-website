import { NextResponse } from "next/server";
import { CarnegiePaymentError, createCarnegiePaymentOrder } from "@/lib/carnegieTrip";
import { isPaypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isPaypalConfigured()) return NextResponse.json({ error: "Online payment is not configured." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  try {
    const result = await createCarnegiePaymentOrder(String(body.checkoutToken || ""));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CarnegiePaymentError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[carnegie-payment-create]", error?.message || error);
    return NextResponse.json({ error: "Could not start payment. Please try again." }, { status: 409 });
  }
}
