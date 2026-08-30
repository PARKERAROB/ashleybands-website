import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { clearStaffCookie, readStaffCookie } from "@/lib/staffAuthCookie";
import { logAudit, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

export async function POST(request) {
  const cookie = readStaffCookie(request);
  if (cookie?.id && cookie?.token) {
    const { data: staff, error } = await supabaseAdmin
      .from("staff")
      .update({ session_token: crypto.randomUUID() })
      .eq("id", cookie.id)
      .eq("session_token", cookie.token)
      .select("id,display_name")
      .maybeSingle();
    if (error) {
      return privateServerError("staff-signout", error, "Staff sign-out could not be completed.");
    }
    if (staff) {
      await logAudit({
        actor: staffActor(staff),
        action: "revoke_session",
        table: "staff",
        recordId: staff.id,
        route: "/api/sponsors/staff-signout",
      });
    }
  }
  const res = privateJson({ ok: true });
  clearStaffCookie(res);
  return res;
}
