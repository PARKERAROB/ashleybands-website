import { SITE_ORIGIN, robotsDisallowPaths } from "@/lib/routes";

// robots.txt from the route registry (#133). Disallows staff, API, portal, prototype and
// internal-brief routes. Disallow is not access control; gated pages keep their own checks.
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: robotsDisallowPaths()
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
