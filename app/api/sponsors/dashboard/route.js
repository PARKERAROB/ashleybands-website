import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

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

  const [{ data: prospects, error: pErr }, { data: dedup, error: dErr }, { data: families }] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select(
        "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, confirmed_by_lead, confirmed_at, created_at, family:families(id, display_name, student_first, student_last, section), business:businesses(id, name_display, category)"
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("prospect_dedup").select("*"),
    supabaseAdmin.from("families").select("id, display_name, student_first, student_last, section, created_at")
  ]);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

  const totals = (prospects || []).reduce(
    (acc, p) => {
      acc.count += 1;
      acc[p.status] = (acc[p.status] || 0) + 1;
      if (p.status === "yes" && p.committed_amount) {
        // Reported = what families self-entered. Confirmed = lead has the signed
        // form. Only confirmed money should be treated as actually raised.
        acc.committed_amount += Number(p.committed_amount);
        if (p.confirmed_by_lead) acc.committed_confirmed += Number(p.committed_amount);
      }
      return acc;
    },
    { count: 0, pending: 0, yes: 0, no: 0, later: 0, committed_amount: 0, committed_confirmed: 0 }
  );

  return NextResponse.json({
    staff: { display_name: staff.display_name, role: staff.role },
    prospects: prospects || [],
    dedup: dedup || [],
    families: families || [],
    totals
  });
}
