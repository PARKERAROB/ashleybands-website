import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";
import { countQueued, dispatchOutreachQueue } from "@/lib/businessOutreachSend";

export const runtime = "nodejs";
// Allow time for a real send loop (Resend per recipient). Vercel Pro honors this.
export const maxDuration = 300;

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

// How many are staged to send. Drives the dashboard "Send queued (N)" button.
export async function GET(req) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ queued: await countQueued() });
}

// L2 BOUNDARY: only runs on a staff member's authenticated click, and only when
// the client affirms `confirm: true` after seeing the count. No schedule, no cron,
// no auto-send. Mirrors the parent-broadcast send gate.
export async function POST(req) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const queued = await countQueued();
  if (!queued) return NextResponse.json({ error: "Nothing is queued to send." }, { status: 400 });

  if (body.confirm !== true) {
    // Confirmation gate: tell the client the count, don't send yet.
    return NextResponse.json({ needsConfirm: true, queued });
  }

  const limit = Number.isFinite(body.limit) && body.limit > 0 ? Math.floor(body.limit) : 0;
  try {
    const result = await dispatchOutreachQueue({ limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
