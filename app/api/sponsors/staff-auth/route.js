import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPin } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const pin = String(body.pin || "").trim();
  if (!email || !pin) {
    return NextResponse.json({ error: "Email and PIN are required" }, { status: 400 });
  }
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, email, pin_hash, session_token, display_name, role")
    .eq("email", email)
    .maybeSingle();
  if (!data || !verifyPin(pin, data.pin_hash)) {
    return NextResponse.json({ error: "Email or PIN not recognized" }, { status: 401 });
  }
  return NextResponse.json({
    id: data.id,
    token: data.session_token,
    role: data.role,
    display_name: data.display_name
  });
}
