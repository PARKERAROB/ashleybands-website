import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hitRateLimit } from "@/lib/rateLimitCore.mjs";

// Fixed-window rate limiter backed by the auth_rate_limits table (lib/rateLimitCore.mjs).
// Authentication callers default to fail-open so a limiter outage cannot lock Rob out.
// Abuse-sensitive public routes pass failOpen:false so a limiter outage cannot become an
// unlimited write path. Database errors count as limiter failures.
export async function checkRateLimit({ key, limit, windowMs, failOpen = true }) {
  try {
    return await hitRateLimit(supabaseAdmin, { key, limit, windowMs });
  } catch {
    return { allowed: failOpen, remaining: failOpen ? limit : 0 };
  }
}

export function clientIp(request) {
  const fwd = request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")
    || "";
  return fwd.split(",")[0].trim() || "unknown";
}

// The attendance and Regiment OS gates check the same shared PIN, so they share one per-network
// budget and one overall budget. The overall cap fails closed: during a guessing burst, PIN
// sign-in pauses for one window while named staff sign-in keeps working.
export async function checkSharedPinLimit(request) {
  const windowMs = 15 * 60 * 1000;
  const network = await checkRateLimit({ key: `shared-pin:${clientIp(request)}`, limit: 20, windowMs, failOpen: false });
  if (!network.allowed) return false;
  const overall = await checkRateLimit({ key: "shared-pin:global", limit: 30, windowMs, failOpen: false });
  return overall.allowed;
}
