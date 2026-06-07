import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClaimToken } from "@/lib/sponsorClaimToken";

export const runtime = "nodejs";

// Day-6 reclaim nudge magic-link handler (build-spec §8).
//
// SCANNER SAFETY (same lesson as business-respond): mail filters / SafeLinks prefetch every
// URL. A bare GET must NEVER change state, or a preview bot could release a family's lead or
// mark it contacted. So:
//   GET  = read-only. Validate the token, bounce to the confirm page.
//   POST = the real action, only fired by an explicit button press on that page.

async function actOnClaim(businessId, familyId, action) {
  // Only act if the lead is still claimed by this family and not already contacted.
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("id, claimed_by_family_id, claim_contacted_at")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz || biz.claimed_by_family_id !== familyId) {
    return { ok: false, reason: "not_yours" };
  }

  if (action === "went") {
    const now = new Date().toISOString();
    await supabaseAdmin.from("businesses").update({ claim_contacted_at: now }).eq("id", businessId);
    await supabaseAdmin
      .from("prospects")
      .update({ contacted_at: now })
      .eq("family_id", familyId)
      .eq("business_id", businessId)
      .is("contacted_at", null);
    return { ok: true, action: "went" };
  }

  // action === "pool": release back to the pool now.
  await supabaseAdmin
    .from("businesses")
    .update({ claimed_by_family_id: null, claimed_at: null, reclaim_at: null, claim_contacted_at: null, reclaim_nudged_at: null })
    .eq("id", businessId);
  await supabaseAdmin
    .from("prospects")
    .delete()
    .eq("family_id", familyId)
    .eq("business_id", businessId)
    .eq("lead_kind", "claimed_warm")
    .is("contacted_at", null);
  return { ok: true, action: "pool" };
}

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  const action = (url.searchParams.get("a") || "").toLowerCase();
  const claim = verifyClaimToken(token);
  if (!claim || !["went", "pool"].includes(action)) {
    return NextResponse.redirect(new URL("/sponsors/claim-confirm?status=invalid", req.url));
  }
  return NextResponse.redirect(new URL(`/sponsors/claim-confirm?t=${encodeURIComponent(token)}&a=${action}`, req.url));
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const action = String(body.action || "").toLowerCase();
  const claim = verifyClaimToken(token);
  if (!claim || !["went", "pool"].includes(action)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const result = await actOnClaim(claim.businessId, claim.familyId, action);
  return NextResponse.json(result);
}
