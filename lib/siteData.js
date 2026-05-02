import siteData from "@/content/site-data.json";

export function getSiteData() {
  return siteData;
}

export function getPageBySlug(slug) {
  return siteData.pages.find((page) => page.slug === slug);
}
