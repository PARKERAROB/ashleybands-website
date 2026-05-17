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

  const url = new URL(req.url);
  const zone = url.searchParams.get("zone") || "";
  const status = url.searchParams.get("status") || "";
  const source = url.searchParams.get("source") || "";
  const search = url.searchParams.get("q") || "";

  let q = supabaseAdmin
    .from("businesses")
    .select(
      "id, name_display, address, city, zip, phone, email, website, contact_person, contact_title, category, zone, source, outreach_status, prior_sponsor, notes, enriched_at, last_outreach_at, willing_at, declined_at"
    )
    .order("prior_sponsor", { ascending: false })
    .order("zone", { ascending: true })
    .order("name_display", { ascending: true })
    .limit(500);

  if (zone) q = q.eq("zone", zone);
  if (status) q = q.eq("outreach_status", status);
  if (source) q = q.like("source", `${source}%`);
  if (search) q = q.ilike("name_display", `%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = data.reduce(
    (acc, b) => {
      acc.count += 1;
      acc.by_status[b.outreach_status] = (acc.by_status[b.outreach_status] || 0) + 1;
      acc.by_zone[b.zone || "unknown"] = (acc.by_zone[b.zone || "unknown"] || 0) + 1;
      if (b.email) acc.with_email += 1;
      if (b.prior_sponsor) acc.prior += 1;
      return acc;
    },
    { count: 0, with_email: 0, prior: 0, by_status: {}, by_zone: {} }
  );

  return NextResponse.json({ businesses: data, totals });
}
