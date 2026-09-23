// Homepage banner for the 2nd Annual Mattress Fundraiser, issue #97.
// Facts come from the private 2026 mattress fundraiser record and the vendor flyer.
// The banner hides itself once Saturday, September 26, 2026 ends in America/New_York.

export const MATTRESS_SALE_EVENT_URL = "https://www.facebook.com/events/1781228726134496";

// Midnight at the end of Saturday, September 26, 2026, Eastern Daylight Time (UTC-4).
export const MATTRESS_SALE_BANNER_ENDS_AT = "2026-09-27T04:00:00.000Z";
export const MATTRESS_SALE_BANNER_ENDS_MS = Date.parse(MATTRESS_SALE_BANNER_ENDS_AT);

export function isMattressSaleBannerActive(nowMs) {
  return Number.isFinite(nowMs) && nowMs < MATTRESS_SALE_BANNER_ENDS_MS;
}
