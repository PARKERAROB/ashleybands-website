import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { normalizeNewsletterEmail } from "@/lib/newsletterFormat.mjs";
import { requestCommunitySubscription } from "@/lib/newsletter";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeNewsletterEmail(body.email);
  if (String(body.website || "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const [emailLimit, ipLimit] = await Promise.all([
    checkRateLimit({ key: `newsletter-subscribe:${email}`, limit: 4, windowMs: 60 * 60 * 1000, failOpen: false }),
    checkRateLimit({ key: `newsletter-subscribe-ip:${clientIp(request)}`, limit: 20, windowMs: 60 * 60 * 1000, failOpen: false })
  ]);
  if (!emailLimit.allowed || !ipLimit.allowed) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  try {
    await requestCommunitySubscription(email);
    return NextResponse.json({
      ok: true,
      message: "If confirmation is needed, check your email. A new subscription is active only after confirmation."
    });
  } catch (error) {
    const message = String(error?.message || error);
    const status = message.includes("valid email") ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? message : "We could not start the subscription. Please try again." }, { status });
  }
}
