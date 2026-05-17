import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Public endpoint, no auth — relies on the random click_token being unguessable.
// GET /api/sponsors/business-respond?t=<click_token>&a=yes|no
export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const action = (url.searchParams.get("a") || "").toLowerCase();

  if (!token || !["yes", "no"].includes(action)) {
    return NextResponse.redirect(new URL("/sponsors/respond?status=invalid", req.url));
  }

  const { data: outreach } = await supabaseAdmin
    .from("business_outreach")
    .select("id, business_id, click_yes_at")
    .eq("click_token", token)
    .maybeSingle();
  if (!outreach) {
    return NextResponse.redirect(new URL("/sponsors/respond?status=invalid", req.url));
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;

  const outreachUpdate = {
    reply_received_at: new Date().toISOString(),
    reply_classification: action
  };
  if (action === "yes") {
    outreachUpdate.click_yes_at = outreach.click_yes_at || new Date().toISOString();
    outreachUpdate.click_yes_ip = ip;
  }
  await supabaseAdmin
    .from("business_outreach")
    .update(outreachUpdate)
    .eq("id", outreach.id);

  const businessUpdate =
    action === "yes"
      ? { outreach_status: "willing", willing_at: new Date().toISOString() }
      : { outreach_status: "declined", declined_at: new Date().toISOString() };
  await supabaseAdmin
    .from("businesses")
    .update(businessUpdate)
    .eq("id", outreach.business_id);

  return NextResponse.redirect(new URL(`/sponsors/respond?status=${action}`, req.url));
}
