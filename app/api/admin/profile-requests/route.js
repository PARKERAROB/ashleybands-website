import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";

export const runtime = "nodejs";

export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("portal_review_queue")
    .select(
      "id, item_type, status, summary, details, email_alert_status, email_alert_sent_at, email_alert_error, created_at, portal_students(display_name, grade_fall26, status), portal_people(display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    staff: { displayName: staff.display_name, role: staff.role },
    requests: data || []
  });
}

export async function PATCH(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["needs_review", "approved", "rejected", "merged", "needs_followup"].includes(status)) {
    return NextResponse.json({ error: "Valid id and status are required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("portal_review_queue")
    .update({
      status,
      details: {
        ...(body.details || {}),
        reviewed_by: staff.display_name,
        reviewed_at: new Date().toISOString()
      }
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
