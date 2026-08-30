import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadAttributeFacets } from "@/lib/audience";

export const runtime = "nodejs";

// Send log + the attribute facets that generate the audience picker.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const [{ data: broadcasts, error }, facets] = await Promise.all([
    supabaseAdmin
      .from("broadcasts")
      .select(
        "id, subject, recipient_axis, status, recipient_count, created_by, sent_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    loadAttributeFacets()
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    staff: { displayName: staff.display_name, role: staff.role },
    broadcasts: broadcasts || [],
    facets
  });
}
