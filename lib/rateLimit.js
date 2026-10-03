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
