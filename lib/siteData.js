import siteData from "@/content/site-data.json";
import { isCurrentFundraiser } from "@/lib/fundraiserStatus.mjs";

export function getSiteData() {
  return siteData;
}

export function getPageBySlug(slug) {
  return siteData.pages.find((page) => page.slug === slug);
}

export function getFundraisers() {
  return siteData.fundraisers || [];
}

// Ended fundraisers stay reachable by slug but are not current (#113).
// An optional endsAt also ends a fundraiser automatically (#123).
export function getCurrentFundraisers(nowMs = Date.now()) {
  return getFundraisers().filter((fundraiser) => isCurrentFundraiser(fundraiser, nowMs));
}

export function getFundraiserBySlug(slug) {
  return getFundraisers().find((fundraiser) => fundraiser.slug === slug);
}
