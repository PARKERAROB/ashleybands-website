import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffCookie } from "@/lib/staffAuthCookie";

export async function validateStaffRequest(req) {
  const cookie = readStaffCookie(req);
  const staffId = cookie?.id || "";
  const token = cookie?.token || "";
  if (!staffId || !token) return null;

  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role, display_name, session_token, disabled_at")
    .eq("id", staffId)
    .is("disabled_at", null)
    .maybeSingle();
  if (!data || !data.session_token) return null;
  const a = Buffer.from(String(data.session_token));
  const b = Buffer.from(String(token));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return data;
}
