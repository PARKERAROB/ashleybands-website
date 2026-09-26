import { SITE_ORIGIN, matchesPrefix, robotsDisallowPaths, sitemapRoutes } from "@/lib/routes";
import { getSiteData } from "@/lib/siteData";

// sitemap.xml from the route registry (#133): public and archive routes marked sitemap: true,
// plus current info pages from the committed content file. Static only, no database reads.
export default function sitemap() {
  const disallowed = robotsDisallowPaths();
  const paths = new Set(sitemapRoutes().map((route) => route.path));
  for (const page of getSiteData().pages || []) {
    if (!page.archived && page.category !== "Archive") paths.add(`/info/${page.slug}`);
  }
  return [...paths]
    .filter((path) => !disallowed.some((base) => matchesPrefix(path, base)))
    .map((path) => ({ url: `${SITE_ORIGIN}${path === "/" ? "" : path}` }));
}
