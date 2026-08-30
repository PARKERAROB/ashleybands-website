import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(req) {
  const access = await authorizeStaffRequest(req, STAFF_CAPABILITIES.ASSETS_READ);
  if (!access.ok) return json({ error: access.error }, access.status);
  const staff = access.staff;

  try {
    const { data, error } = await supabaseAdmin
      .from("music_library_inventory")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (error) return json({ error: "Could not load the music library." }, 500);
    await logAudit({
      actor: staffActor(staff),
      action: "music_library.viewed",
      table: "music_library_inventory",
      recordId: "all",
      changes: { item_count: (data || []).length },
      route: "/api/music-library/admin"
    });
    return json({ items: data || [] });
  } catch {
    return json({ error: "Could not load the music library." }, 500);
  }
}

export async function PATCH(req) {
  const access = await authorizeStaffRequest(req, STAFF_CAPABILITIES.ASSETS_WRITE);
  if (!access.ok) return json({ error: access.error }, access.status);
  const staff = access.staff;

  try {
    const body = await req.json();
    const { id, review_status } = body;
    if (!id || !["reviewed", "verified", "rejected"].includes(review_status)) {
      return json({ error: "Valid id and review_status required" }, 400);
    }
    const { data, error } = await supabaseAdmin
      .from("music_library_inventory")
      .update({ review_status, reviewed_at: new Date().toISOString(), reviewed_by: staff.display_name })
      .eq("id", id)
      .select("id")
      .single();
    if (error) return json({ error: "Could not update the music library review." }, 500);
    await logAudit({
      actor: staffActor(staff),
      action: "music_library.review_updated",
      table: "music_library_inventory",
      recordId: data.id,
      changes: { review_status },
      route: "/api/music-library/admin"
    });
    return json({ id: data.id, status: review_status });
  } catch {
    return json({ error: "Could not update the music library." }, 500);
  }
}
