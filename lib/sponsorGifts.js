import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tierForAmount } from "@/lib/sponsorRecognition";

// Persistence helper for business gifts (build-spec §5). Keeps the give routes thin and
// guarantees every gift row is built the same way regardless of method (online / check).

export function giftInvoiceId() {
  return `AB-SP-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();
}

// Normalize a dollar/cents amount from a request into validated integer cents.
// Returns { cents } or { error }.
export function parseGiftAmountCents(body) {
  let cents;
  if (body.amount_cents != null) cents = Math.round(Number(body.amount_cents));
  else if (body.amount != null) cents = Math.round(Number(body.amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return { error: "Enter a gift amount." };
  if (cents < 500) return { error: "Minimum online gift is $5." };
  if (cents > 5000000) return { error: "For gifts over $50,000, please contact the director directly." };
  return { cents };
}

// Resolve the business + attribution for a gift from a request body. A gift can come in
//   - keyed to a known business (business_id) and/or a bringing family's prospect (prospect_id), or
//   - free-form, with the sponsor typing their business name.
async function resolveGiftTargets({ businessId, prospectId, businessName }) {
  let resolvedBusinessId = businessId || null;
  let resolvedName = (businessName || "").trim();
  let familyId = null;

  if (prospectId) {
    const { data: prospect } = await supabaseAdmin
      .from("prospects")
      .select("id, family_id, business_id")
      .eq("id", prospectId)
      .maybeSingle();
    if (prospect) {
      familyId = prospect.family_id || null;
      if (!resolvedBusinessId) resolvedBusinessId = prospect.business_id;
    }
  }

  if (resolvedBusinessId) {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("id, name_display")
      .eq("id", resolvedBusinessId)
      .maybeSingle();
    if (biz) {
      if (!resolvedName) resolvedName = biz.name_display;
    } else {
      resolvedBusinessId = null; // stale id
    }
  }

  return { businessId: resolvedBusinessId, businessName: resolvedName, familyId };
}

// Create a pending gift row. method = 'online' | 'check'. recordedBy tags the source.
export async function createPendingGift({
  amountCents,
  method,
  businessId,
  prospectId,
  businessName,
  payerName,
  payerEmail,
  recordedBy
}) {
  const targets = await resolveGiftTargets({ businessId, prospectId, businessName });
  if (!targets.businessName) {
    return { error: "Tell us your business name." };
  }

  const insert = {
    business_id: targets.businessId,
    family_id: targets.familyId,
    prospect_id: prospectId || null,
    business_name: targets.businessName,
    amount_cents: amountCents,
    method,
    status: "pending",
    tier: tierForAmount(amountCents),
    payer_name: (payerName || "").trim(),
    payer_email: (payerEmail || "").trim(),
    invoice_id: giftInvoiceId(),
    recorded_by: recordedBy || ""
  };

  const { data, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .insert(insert)
    .select("id, invoice_id, amount_cents, business_name, tier, method, status")
    .single();
  if (error) return { error: error.message };
  return { gift: data };
}
