import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

const SORT_COLUMNS = {
  name: "name_display",
  zone: "zone",
  email: "email",
  phone: "phone",
  website: "website",
  source: "source",
  status: "outreach_status",
  prior: "prior_sponsor",
  enriched: "enriched_at",
  last_outreach: "last_outreach_at"
};

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
  const sort = url.searchParams.get("sort") || "";
  const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
  const sortColumn = SORT_COLUMNS[sort];

  let q = supabaseAdmin
    .from("businesses")
    .select(
      "id, name_display, address, city, zip, phone, email, website, contact_person, contact_title, category, zone, source, outreach_status, prior_sponsor, notes, enriched_at, last_outreach_at, willing_at, declined_at"
    );

  if (zone) q = q.eq("zone", zone);
  if (status) q = q.eq("outreach_status", status);
  if (source) q = q.like("source", `${source}%`);
  if (search) q = q.ilike("name_display", `%${search}%`);

  if (sortColumn) {
    q = q
      .order(sortColumn, { ascending: dir === "asc", nullsFirst: false })
      .order("name_display", { ascending: true, nullsFirst: false });
  } else {
    q = q
      .order("prior_sponsor", { ascending: false })
      .order("zone", { ascending: true, nullsFirst: false })
      .order("name_display", { ascending: true });
  }

  q = q.limit(500);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cross-path overlap: how many families are also pursuing each business via the
  // warm tracker. Lets staff see a cold-DB business that's already being worked in
  // person, so it doesn't get cold-emailed on top of a family visit.
  const { data: prospectRows } = await supabaseAdmin
    .from("prospects")
    .select("business_id, family_id");
  const familyByBiz = {};
  for (const row of prospectRows || []) {
    if (!row.business_id) continue;
    (familyByBiz[row.business_id] ||= new Set()).add(row.family_id);
  }
  for (const b of data) {
    b.family_count = familyByBiz[b.id] ? familyByBiz[b.id].size : 0;
  }

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
