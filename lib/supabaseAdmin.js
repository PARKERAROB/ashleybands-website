import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.warn(
    "[supabaseAdmin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY — sponsor tracker APIs will fail."
  );
}

export const supabaseAdmin = createClient(url || "", secret || "", {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function canonicalName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
