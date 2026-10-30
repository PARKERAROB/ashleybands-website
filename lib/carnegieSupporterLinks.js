import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CARNEGIE_CAMPAIGN } from "@/lib/sponsorCampaigns.mjs";
import { giftCreditedCents } from "@/lib/carnegieLetters.mjs";

const SUPPORTER_CODE_RE = /^[a-z0-9-]{3,40}$/;
const FIELDS = "id, code, display_name";

// A trusted adult's whole-trip Music Notes link (#247). Only an active row resolves.
export async function resolveCarnegieSupporterCode(code) {
  const value = String(code || "").trim().toLowerCase();
  if (!SUPPORTER_CODE_RE.test(value)) return null;
  const { data, error } = await supabaseAdmin
    .from("carnegie_supporter_links")
    .select(FIELDS)
    .eq("code", value)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error("The supporter link could not be loaded.");
  return data || null;
}

export async function resolveCarnegieSupporterId(id) {
  const { data, error } = await supabaseAdmin
    .from("carnegie_supporter_links")
    .select(FIELDS)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error("The supporter link could not be loaded.");
  return data || null;
}

// Only confirmed gifts count, after PayPal's fee, the same as a student's notes.
export async function confirmedSupporterCents(supporterLinkId) {
  const { data, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .select("amount_cents, paypal_fee_cents")
    .eq("supporter_link_id", supporterLinkId)
    .eq("campaign_code", CARNEGIE_CAMPAIGN)
    .eq("status", "confirmed");
  if (error) throw new Error("Notes could not be loaded.");
  return (data || []).reduce((total, gift) => total + giftCreditedCents(gift), 0);
}
