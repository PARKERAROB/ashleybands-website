import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";
import { readStaffCookie } from "@/lib/staffAuthCookie";

export async function validateStaffRequest(req) {
  // Prefer the httpOnly cookie; fall back to legacy x-staff-* headers so
  // already-signed-in sessions (localStorage token) keep working post-deploy.
  let staffId = "";
  let token = "";
  const cookie = readStaffCookie(req);
  if (cookie?.id && cookie?.token) {
    staffId = cookie.id;
    token = cookie.token;
  } else {
    const legacy = readStaffSession(req);
    staffId = legacy.staffId;
    token = legacy.token;
  }
  if (!staffId || !token) return null;

  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role, display_name, session_token")
    .eq("id", staffId)
    .maybeSingle();
  if (!data || data.session_token !== token) return null;
  return data;
}
