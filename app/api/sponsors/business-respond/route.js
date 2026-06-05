import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Business willingness opt-in. Public, no auth — relies on the random click_token
// being unguessable.
//
// SCANNER SAFETY: corporate mail filters, Outlook SafeLinks, and link-preview bots
// fetch every URL in an email automatically. So a bare GET must NEVER change state,
// or those bots would silently mark businesses willing/declined before a human acts.
//   - GET  = read-only. Validates the token and bounces to the confirmation page.
//   - POST = the actual opt-in, only fired by an explicit human button click.

async function lookupOutreach(token) {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("business_outreach")
    .select("id, business_id, click_yes_at, business:businesses(name_display)")
    .eq("click_token", token)
    .maybeSingle();
  return data || null;
}

// Read-only. Legacy email links pointed straight here with ?t=&a=; instead of
// mutating, send them to the confirm page so the click still has to be deliberate.
export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const action = (url.searchParams.get("a") || "").toLowerCase();

  const outreach = token ? await lookupOutreach(token) : null;
  if (!outreach || !["yes", "no"].includes(action)) {
    return NextResponse.redirect(new URL("/sponsors/respond?status=invalid", req.url));
  }
  return NextResponse.redirect(new URL(`/sponsors/respond?t=${token}&a=${action}`, req.url));
}

// The real opt-in. Only an explicit button press on the confirm page hits this.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const action = String(body.action || "").toLowerCase();

  if (!token || !["yes", "no"].includes(action)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const outreach = await lookupOutreach(token);
  if (!outreach) {
    return NextResponse.json({ error: "invalid" }, { status: 404 });
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
  await supabaseAdmin.from("business_outreach").update(outreachUpdate).eq("id", outreach.id);

  const businessUpdate =
    action === "yes"
      ? { outreach_status: "willing", willing_at: new Date().toISOString() }
      : { outreach_status: "declined", declined_at: new Date().toISOString() };
  await supabaseAdmin.from("businesses").update(businessUpdate).eq("id", outreach.business_id);

  return NextResponse.json({ ok: true, status: action });
}
