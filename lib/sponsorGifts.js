import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tierForAmount } from "@/lib/sponsorRecognition";
import {
  giftInvoiceIdForRequest,
  reconcileGiftAttribution
} from "@/lib/sponsorGiftPolicy.mjs";
import { verifySponsorGiveToken } from "@/lib/sponsorGiveToken.mjs";
import { resolveSponsorStudentTokenClaims } from "@/lib/sponsorStudentLinks";

// Persistence helper for business gifts (build-spec §5). Keeps the give routes thin and
// guarantees every gift row is built the same way regardless of method (online / check).

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

// A family attribution is accepted only through a signed token. The token binds one prospect
// to one business, and the canonical name is always reloaded from the database. Direct public
// gifts remain possible with a free-form business name, but receive no family attribution.
export async function resolveGiftTargets({ attributionToken, businessName }) {
  if (!attributionToken) {
    return {
      businessId: null,
      prospectId: null,
      familyId: null,
      portalStudentId: null,
      studentName: null,
      businessName: String(businessName || "").trim()
    };
  }

  const tokenClaims = verifySponsorGiveToken(attributionToken);
  if (!tokenClaims) throw new Error("This sponsorship link is invalid or expired.");

  if (tokenClaims.linkId && tokenClaims.studentId) {
    const studentTarget = await resolveSponsorStudentTokenClaims(tokenClaims);
    if (!studentTarget) throw new Error("This student sponsorship link is no longer active.");
    return {
      businessId: null,
      prospectId: null,
      familyId: null,
      portalStudentId: studentTarget.portalStudentId,
      studentName: studentTarget.studentName,
      businessName: String(businessName || "").trim()
    };
  }

  const [{ data: prospect }, { data: business }] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select("id, family_id, business_id")
      .eq("id", tokenClaims.prospectId)
      .maybeSingle(),
    supabaseAdmin
      .from("businesses")
      .select("id, name_display")
      .eq("id", tokenClaims.businessId)
      .maybeSingle()
  ]);
  const targets = reconcileGiftAttribution({ tokenClaims, prospect, business });
  let portalStudentId = null;
  if (targets.familyId) {
    const { data: family } = await supabaseAdmin
      .from("families")
      .select("portal_student_id")
      .eq("id", targets.familyId)
      .maybeSingle();
    portalStudentId = family?.portal_student_id || null;
  }
  return { ...targets, portalStudentId, studentName: null };
}

export async function publicGiftLinkDetails(attributionToken) {
  if (!attributionToken) return { name: null, student_name: null };
  const targets = await resolveGiftTargets({ attributionToken, businessName: "" });
  return {
    name: targets.businessName || null,
    student_name: targets.studentName || null
  };
}

// Create a pending gift row. method = 'online' | 'check'. recordedBy tags the source.
export async function createPendingGift({
  amountCents,
  method,
  requestKey,
  attributionToken,
  businessName,
  payerName,
  payerEmail,
  recordedBy
}) {
  let targets;
  try {
    targets = await resolveGiftTargets({ attributionToken, businessName });
  } catch (error) {
    return { error: String(error?.message || error), status: 400 };
  }
  if (!targets.businessName) {
    return { error: "Tell us your name or business name." };
  }

  const invoiceId = giftInvoiceIdForRequest(requestKey);

  const insert = {
    business_id: targets.businessId,
    family_id: targets.familyId,
    prospect_id: targets.prospectId,
    portal_student_id: targets.portalStudentId,
    business_name: targets.businessName,
    amount_cents: amountCents,
    method,
    status: "pending",
    tier: tierForAmount(amountCents),
    payer_name: (payerName || "").trim(),
    payer_email: (payerEmail || "").trim(),
    invoice_id: invoiceId,
    recorded_by: recordedBy || ""
  };

  const fields = "id, invoice_id, amount_cents, business_name, tier, method, status, paypal_order_id";
  const { data, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .insert(insert)
    .select(fields)
    .single();
  if (error?.code === "23505") {
    const { data: existing } = await supabaseAdmin
      .from("sponsor_gifts")
      .select(fields)
      .eq("invoice_id", invoiceId)
      .maybeSingle();
    const sameRequest = existing
      && existing.method === method
      && existing.amount_cents === amountCents
      && existing.business_name === targets.businessName;
    if (sameRequest) return { gift: existing, existing: true };
    return { error: "This gift request was already used. Please reload and try again.", status: 409 };
  }
  if (error) return { error: error.message, status: 500 };
  return { gift: data };
}
