import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Fixed-window rate limiter backed by the auth_rate_limits table.
// IMPORTANT: fail-OPEN — any error (incl. table missing) allows the request,
// so a rate-limit bug can never lock a legitimate user (or Rob) out.
export async function checkRateLimit({ key, limit, windowMs }) {
  try {
    const now = Date.now();
    const { data } = await supabaseAdmin
      .from("auth_rate_limits")
      .select("window_start, count")
      .eq("key", key)
      .maybeSingle();

    if (!data) {
      await supabaseAdmin
        .from("auth_rate_limits")
        .upsert({ key, window_start: new Date(now).toISOString(), count: 1, updated_at: new Date(now).toISOString() });
      return { allowed: true, remaining: limit - 1 };
    }

    const windowStart = new Date(data.window_start).getTime();
    if (now - windowStart > windowMs) {
      // window expired -> reset
      await supabaseAdmin
        .from("auth_rate_limits")
        .update({ window_start: new Date(now).toISOString(), count: 1, updated_at: new Date(now).toISOString() })
        .eq("key", key);
      return { allowed: true, remaining: limit - 1 };
    }

    if (data.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    await supabaseAdmin
      .from("auth_rate_limits")
      .update({ count: data.count + 1, updated_at: new Date(now).toISOString() })
      .eq("key", key);
    return { allowed: true, remaining: limit - data.count - 1 };
  } catch {
    return { allowed: true, remaining: limit }; // fail open
  }
}

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || "unknown";
}
