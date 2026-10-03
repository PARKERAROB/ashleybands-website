// Fixed-window counter on auth_rate_limits. Every allowed hit must win a conditional
// update on the count and window it read, so concurrent requests cannot share one slot.
// Database errors are thrown; checkRateLimit maps them to its failOpen choice.
const MAX_CONTENTION_RETRIES = 8;

export async function hitRateLimit(client, { key, limit, windowMs, now = Date.now() }) {
  const nowIso = new Date(now).toISOString();
  for (let attempt = 0; attempt < MAX_CONTENTION_RETRIES; attempt += 1) {
    const { data, error } = await client
      .from("auth_rate_limits")
      .select("window_start, count")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      const { error: insertError } = await client
        .from("auth_rate_limits")
        .insert({ key, window_start: nowIso, count: 1, updated_at: nowIso });
      if (!insertError) return { allowed: true, remaining: limit - 1 };
      if (insertError.code === "23505") continue;
      throw insertError;
    }

    const expired = now - new Date(data.window_start).getTime() > windowMs;
    if (!expired && data.count >= limit) return { allowed: false, remaining: 0 };
    const next = expired ? 1 : data.count + 1;
    const { data: won, error: updateError } = await client
      .from("auth_rate_limits")
      .update({ count: next, updated_at: nowIso, ...(expired ? { window_start: nowIso } : {}) })
      .eq("key", key)
      .eq("count", data.count)
      .eq("window_start", data.window_start)
      .select("key");
    if (updateError) throw updateError;
    if (won?.length === 1) return { allowed: true, remaining: limit - next };
  }
  // ponytail: sustained contention on one key is itself a burst; deny instead of looping.
  return { allowed: false, remaining: 0 };
}
