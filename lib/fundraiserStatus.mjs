// A fundraiser is current until it is archived or its optional endsAt moment passes (#123).
// endsAt is an ISO timestamp, the same pattern as the banner end in lib/mattressSaleBanner.mjs.
export function isCurrentFundraiser(fundraiser, nowMs = Date.now()) {
  if (!fundraiser || fundraiser.archived) return false;
  if (!fundraiser.endsAt) return true;
  const endsMs = Date.parse(fundraiser.endsAt);
  if (!Number.isFinite(endsMs)) return true;
  return Number.isFinite(nowMs) && nowMs < endsMs;
}
