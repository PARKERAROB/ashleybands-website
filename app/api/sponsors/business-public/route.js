import { NextResponse } from "next/server";
import { sponsorFunnelLive } from "@/lib/sponsorFamily";
import { publicGiftLinkDetails } from "@/lib/sponsorGifts";

export const runtime = "nodejs";

// Public display lookup for a signed sponsor-payment link. Business links return only the
// canonical business name. Student links return only the student's first name. Raw database
// ids, family identities, contacts, and other student fields never leave this route.
export async function GET(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "not_open" }, { status: 404 });
  }
  const token = (new URL(req.url).searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ name: null });
  try {
    return NextResponse.json(await publicGiftLinkDetails(token));
  } catch {
    return NextResponse.json({ error: "invalid_link" }, { status: 400 });
  }
}
