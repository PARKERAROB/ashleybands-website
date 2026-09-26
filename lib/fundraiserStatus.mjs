// A fundraiser is current until it is archived or its optional endsAt moment passes (#123).
// endsAt is an ISO timestamp, for example "2026-09-27T04:00:00.000Z" for midnight Eastern.
export function isCurrentFundraiser(fundraiser, nowMs = Date.now()) {
  if (!fundraiser || fundraiser.archived) return false;
  if (!fundraiser.endsAt) return true;
  const endsMs = Date.parse(fundraiser.endsAt);
  if (!Number.isFinite(endsMs)) return true;
  return Number.isFinite(nowMs) && nowMs < endsMs;
}
