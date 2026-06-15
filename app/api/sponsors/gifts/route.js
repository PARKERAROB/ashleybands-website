import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

// Staff gift list for the sponsorship dashboard. Pending check pledges that need confirming
// on arrival, plus the confirmed history. Staff-only.
async function validateStaff(req) {
  const { staffId, token } = readStaffSession(req);
  if (!staffId || !token) return null;
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role, display_name, session_token")
    .eq("id", staffId)
    .maybeSingle();
  if (!data || data.session_token !== token) return null;
  return data;
}

export async function GET(req) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .select(
      "id, business_name, amount_cents, method, status, tier, payer_name, payer_email, fmv_cents, deductible_cents, receipt_number, recognition_status, listed_on_site, recorded_by, confirmed_at, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const gifts = data || [];
  const confirmedCents = gifts
    .filter((g) => g.status === "confirmed")
    .reduce((sum, g) => sum + (g.amount_cents || 0), 0);
  return NextResponse.json({ gifts, confirmedCents });
}
