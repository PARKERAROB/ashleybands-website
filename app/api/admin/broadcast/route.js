import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { loadAttributeFacets } from "@/lib/audience";

export const runtime = "nodejs";

// Send log + the attribute facets that generate the audience picker.
export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

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
