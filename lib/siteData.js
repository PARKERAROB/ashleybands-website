import siteData from "@/content/site-data.json";

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
export function getCurrentFundraisers() {
  return getFundraisers().filter((fundraiser) => !fundraiser.archived);
}

export function getFundraiserBySlug(slug) {
  return getFundraisers().find((fundraiser) => fundraiser.slug === slug);
}
