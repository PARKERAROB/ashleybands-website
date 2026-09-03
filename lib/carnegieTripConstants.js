export const CARNEGIE_AGREEMENT_VERSION = "2026-09-03-v2";
export const CARNEGIE_LEGACY_AGREEMENT_VERSION = "2026-09-01-v1";
export const CARNEGIE_DEPOSIT_CATEGORY = "carnegie_2027_conditional_deposit";
export const CARNEGIE_DEPOSIT_CENTS = 5_000;
export const CARNEGIE_PUBLIC_PATH = "/carnegie-2027/commit";

export const CARNEGIE_RESPONSE_OPTIONS = Object.freeze([
  { value: "serious_yes", label: "Yes - my student intends to participate, and our family can plan for up to $2,000" },
  { value: "interested_limited", label: "Yes - my student intends to participate if the family responsibility can be reduced below $2,000" },
  { value: "no", label: "No - my student cannot participate regardless of financial assistance" },
]);

export const CARNEGIE_AMOUNT_BANDS = Object.freeze([
  { value: "full_assistance_required", label: "Full or near-full financial assistance would be required" },
  { value: "up_to_500", label: "Approximately $500 or less" },
  { value: "501_1000", label: "$501-$1,000" },
  { value: "1001_1500", label: "$1,001-$1,500" },
  { value: "1501_1999", label: "$1,501-$1,999" },
]);

const LEGACY_RESPONSE_LABELS = Object.freeze({
  serious_yes: "Yes - serious intent to participate",
  interested_limited: "Interested, but not able to commit at $2,000",
  no: "No - not planning to participate",
});

const LEGACY_AMOUNT_BAND_LABELS = Object.freeze({
  "500_or_less": "$500 or less",
  "501_1000": "$501-$1,000",
  "1001_1500": "$1,001-$1,500",
  "1501_1999": "$1,501-$1,999",
});

export const CARNEGIE_HELP_OPTIONS = Object.freeze([
  { value: "fundraising", label: "Participate actively in approved Carnegie fundraising" },
  { value: "sponsor_connection", label: "Introduce a business, foundation, sponsor, or major donor" },
  { value: "media_connection", label: "Introduce a media contact, arts supporter, civic group, or community leader" },
  { value: "campaign_help", label: "Help with outreach, events, communications, or donor stewardship" },
  { value: "donation_information", label: "Request information about a tax-deductible program donation" },
  { value: "trip_logistics", label: "Volunteer with trip logistics or chaperone planning" },
  { value: "respond_only", label: "Respond promptly, but no added volunteer capacity right now" },
]);

export function carnegieResponseLabel(value, agreementVersion = CARNEGIE_AGREEMENT_VERSION) {
  if (agreementVersion === CARNEGIE_LEGACY_AGREEMENT_VERSION) {
    return LEGACY_RESPONSE_LABELS[value] || "No response";
  }
  return CARNEGIE_RESPONSE_OPTIONS.find((option) => option.value === value)?.label || "No response";
}

export function carnegieAmountBandLabel(value, agreementVersion = CARNEGIE_AGREEMENT_VERSION) {
  if (agreementVersion === CARNEGIE_LEGACY_AGREEMENT_VERSION) {
    return LEGACY_AMOUNT_BAND_LABELS[value] || "";
  }
  if (value === "500_or_less") return LEGACY_AMOUNT_BAND_LABELS[value];
  return CARNEGIE_AMOUNT_BANDS.find((option) => option.value === value)?.label || "";
}
