import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPin, verifyPin } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

function bad(msg, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid request");
  }

  const mode = body.mode === "signup" ? "signup" : "login";
  const displayName = String(body.display_name || "").trim();
  const pin = String(body.pin || "").trim();

  if (!displayName || !/^\d{4}$/.test(pin)) {
    return bad("Family name and a 4-digit PIN are required.");
  }

  if (mode === "signup") {
    const { data: existing } = await supabaseAdmin
      .from("families")
      .select("id")
      .ilike("display_name", displayName)
      .maybeSingle();
    if (existing) {
      return bad("A family with that name already exists. Use Log In instead.");
    }
    const insert = {
      display_name: displayName,
      pin_hash: hashPin(pin),
      student_first: String(body.student_first || "").trim() || null,
      student_last: String(body.student_last || "").trim() || null,
      section: String(body.section || "").trim() || null
    };
    const { data, error } = await supabaseAdmin
      .from("families")
      .insert(insert)
      .select("id, session_token, display_name")
      .single();
    if (error) return bad(error.message, 500);
    return NextResponse.json({
      id: data.id,
      token: data.session_token,
      display_name: data.display_name
    });
  }

  // login
  const { data: fam } = await supabaseAdmin
    .from("families")
    .select("id, pin_hash, session_token, display_name")
    .ilike("display_name", displayName)
    .maybeSingle();
  if (!fam || !verifyPin(pin, fam.pin_hash)) {
    return bad("Family name or PIN not recognized.", 401);
  }
  return NextResponse.json({
    id: fam.id,
    token: fam.session_token,
    display_name: fam.display_name
  });
}
