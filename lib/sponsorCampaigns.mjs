// Public campaign vocabulary. Gift purpose is persisted server-side, never inferred at capture.
export const CARNEGIE_CAMPAIGN = "carnegie-2027";
export const CARNEGIE_GIVING_PATH = "/support-carnegie";
export const BOOSTER_NONPROFIT_COPY = "Gifts are received by Ashley High School Band Boosters, a registered 501(c)(3) nonprofit organization. Contributions are tax-deductible to the extent allowed by law. EIN: 20-5605218.";
export const CARNEGIE_PURPOSE = "Your gift supports Ashley Bands’ 2027 Carnegie Hall performance trip, including travel costs and participation assistance. Gifts are administered by the Ashley High School Band Boosters for the group trip; they do not create an individual student balance.";
// Trip-change terms approved by the director with publication authorization, September 10, 2026.
export const CARNEGIE_ORIGINAL_CHANGE_TERMS = "If the trip is canceled or your gift cannot be used for this purpose, the boosters will contact you about a refund or your permission to redirect the gift. Any funds remaining after trip expenses will be handled the same way.";
export const CARNEGIE_TERMS_VERSION = "carnegie-2027-v2";
export const CARNEGIE_CHANGE_TERMS = "Gifts support Ashley Bands’ Carnegie Hall trip. If the trip is canceled, cannot proceed as planned, or funds remain after trip expenses, the Ashley High School Band Boosters may use those funds for other educational activities and participation assistance within the Ashley band program.";

// Suggested amounts settled by the director, September 22, 2026. Another amount is always allowed.
export const CARNEGIE_SUGGESTED_AMOUNTS = {
  donation: [25, 50, 100, 250, 500],
  sponsorship: [500, 1000, 2500, 5000, 10000]
};

// Link prefill only seeds editable form state; the server validates every gift independently.
export function carnegieGiftPrefill(kind, amount) {
  const giftKind = kind === "business" || kind === "sponsorship" ? "sponsorship" : kind === "personal" || kind === "donation" ? "donation" : null;
  const dollars = /^\d{1,6}$/.test(amount || "") ? Number(amount) : null;
  return { giftKind, amount: dollars && dollars >= 5 ? String(dollars) : "" };
}

export function giftTermsVersion(campaignCode, value) {
  if (campaignCode !== CARNEGIE_CAMPAIGN) return null;
  const version = value == null ? "carnegie-2027-v1" : value;
  if (!["carnegie-2027-v1", CARNEGIE_TERMS_VERSION].includes(version)) throw new Error("Please reload the giving page to review the gift terms.");
  return version;
}
export function giftChangeTerms(version) {
  return version === CARNEGIE_TERMS_VERSION ? CARNEGIE_CHANGE_TERMS : CARNEGIE_ORIGINAL_CHANGE_TERMS;
}


export function normalizeGiftPurpose({ campaign_code, gift_kind } = {}) {
  const campaignCode = campaign_code == null ? "general" : campaign_code;
  const giftKind = gift_kind == null ? "sponsorship" : gift_kind;
  if (!["general", CARNEGIE_CAMPAIGN].includes(campaignCode)) throw new Error("Choose a valid giving campaign.");
  if (!["donation", "sponsorship"].includes(giftKind)) throw new Error("Choose donation or business sponsorship.");
  return { campaignCode, giftKind };
}

export function giftCampaignLabel(code) {
  return code === CARNEGIE_CAMPAIGN ? "Ashley Bands Carnegie trip 2027" : "General band support";
}

export function sameGiftRequest(existing, proposed) {
  return Boolean(existing
    && existing.method === proposed.method
    && existing.amount_cents === proposed.amount_cents
    && existing.business_name === proposed.business_name
    && (existing.campaign_code || "general") === proposed.campaign_code
    && (existing.gift_kind || "sponsorship") === proposed.gift_kind
    && giftTermsVersion(existing.campaign_code || "general", existing.gift_terms_version) === proposed.gift_terms_version
    && (existing.portal_student_id || null) === proposed.portal_student_id
    && (existing.family_id || null) === proposed.family_id
    && (existing.prospect_id || null) === proposed.prospect_id
    && (existing.business_id || null) === proposed.business_id);
}

export function campaignGiftSummary(gifts = [], campaignCode = CARNEGIE_CAMPAIGN) {
  const selected = gifts.filter(gift => gift.campaign_code === campaignCode);
  const confirmed = selected.filter(gift => gift.status === "confirmed");
  const pending = selected.filter(gift => gift.status === "pending");
  return {
    confirmedCount: confirmed.length,
    confirmedCents: confirmed.reduce((sum, gift) => sum + Number(gift.amount_cents || 0), 0),
    pendingCount: pending.length,
    pendingCents: pending.reduce((sum, gift) => sum + Number(gift.amount_cents || 0), 0)
  };
}

// Student credit is record-keeping per campaign (#103). Marching band per-student fee, funding-goal
// and sponsorship math counts only general gifts. A Carnegie gift credited to a student counts in the
// band's Carnegie total and in that student's Carnegie credit: one amount shown two ways. It is never
// a balance, never reduces what a family owes and never enters marching figures.
export const MARCHING_STUDENT_CREDIT_CAMPAIGN = "general";
export function countsTowardMarchingStudentCredit(gift) {
  return (gift?.campaign_code || "general") === MARCHING_STUDENT_CREDIT_CAMPAIGN;
}

// Staff-only per-student Carnegie credit totals from confirmed gifts. No family or student surface.
export function carnegieStudentCreditTotals(gifts = []) {
  const totals = new Map();
  for (const gift of gifts) {
    if (gift?.campaign_code !== CARNEGIE_CAMPAIGN || gift.status !== "confirmed" || !gift.portal_student_id) continue;
    const total = totals.get(gift.portal_student_id) || { studentId: gift.portal_student_id, confirmedGifts: 0, confirmedCents: 0 };
    total.confirmedGifts += 1;
    total.confirmedCents += Number(gift.amount_cents || 0);
    totals.set(gift.portal_student_id, total);
  }
  return [...totals.values()];
}

// Donor-facing line on the Carnegie page, shown only after arriving through a student link.
export function carnegieStudentGiftLine(firstName) {
  const name = String(firstName || "").trim().split(/\s+/)[0];
  if (!name) return null;
  return `Every gift lowers the trip cost for every student. Yours counts toward ${name}’s music notes and the band’s Carnegie total.`;
}

// Offline gifts staff record from the band room. Carnegie only; recognition is never auto-published.
export const OFFLINE_GIFT_METHODS = ["check", "cash"];
export function normalizeOfflineGiftInput(body = {}) {
  const donorName = String(body.donor_name || "").trim().slice(0, 160);
  if (!donorName) throw new Error("Enter the donor or business name.");
  if ((body.campaign_code || CARNEGIE_CAMPAIGN) !== CARNEGIE_CAMPAIGN) throw new Error("Offline gifts here are for the Carnegie campaign.");
  const method = OFFLINE_GIFT_METHODS.includes(body.method) ? body.method : null;
  if (!method) throw new Error("Choose check or cash.");
  const giftKind = body.gift_kind === "sponsorship" ? "sponsorship" : body.gift_kind === "donation" ? "donation" : null;
  if (!giftKind) throw new Error("Choose donation or business sponsorship.");
  const studentId = body.student_id == null || body.student_id === "" ? null : String(body.student_id);
  if (studentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) throw new Error("Choose a student from the list.");
  const payerEmail = String(body.payer_email || "").trim().toLowerCase().slice(0, 254);
  if (payerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) throw new Error("Enter a valid receipt email or leave it blank.");
  const requestKey = String(body.request_key || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey)) throw new Error("Reload the dashboard and try again.");
  return {
    campaignCode: CARNEGIE_CAMPAIGN,
    donorName,
    payerName: String(body.payer_name || "").trim().slice(0, 160),
    payerEmail,
    method,
    giftKind,
    studentId,
    memo: String(body.memo || "").trim().slice(0, 500),
    requestKey
  };
}

// Production campaign checkout must use matching live credentials; sandbox remains usable locally.
export function campaignOnlineReady(env = {}) {
  const usable = value => Boolean(value && !/^\[(SENSITIVE|REDACTED)\]$/i.test(String(value).trim()));
  return usable(env.PAYPAL_CLIENT_ID) && usable(env.PAYPAL_CLIENT_SECRET)
    && env.PAYPAL_CLIENT_ID === env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
    && (env.VERCEL_ENV !== "production" || env.PAYPAL_ENV === "live");
}
