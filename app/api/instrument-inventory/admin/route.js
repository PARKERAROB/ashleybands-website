import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";

export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from("instrument_inventory")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, review_status } = body;

    if (!id || !["reviewed", "verified", "rejected"].includes(review_status)) {
      return NextResponse.json({ error: "Valid id and review_status required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("instrument_inventory")
      .update({
        review_status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: staff.display_name,
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id, status: review_status });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}