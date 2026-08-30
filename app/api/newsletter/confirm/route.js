import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { confirmCommunitySubscription } from "@/lib/newsletter";

export const runtime = "nodejs";

export async function POST(request) {
  const { token } = await request.json().catch(() => ({}));
  const limit = await checkRateLimit({
    key: `newsletter-confirm:${clientIp(request)}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
    failOpen: false
  });
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  const confirmed = await confirmCommunitySubscription(String(token || ""));
  if (!confirmed) {
    return NextResponse.json({ error: "This confirmation has expired or is no longer valid." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
