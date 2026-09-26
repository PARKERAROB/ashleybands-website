// Route registry (#133). One list of every page route in app/, so the nav, the footer,
// /sitemap-page, robots.txt and sitemap.xml all agree. scripts/route-registry.test.mjs fails
// when an app/**/page.jsx is missing here or an entry points at a page that does not exist.
//
// Fields:
//   path       Route path. Dynamic routes keep their folder name, e.g. "/fundraising/[slug]".
//   title      Plain page name, used on /sitemap-page.
//   door       public | family | workspace | archive | prototype | hidden-chrome
//              public: anyone. family: Family Portal pages (sign-in or family link).
//              workspace: staff tools. archive: past events and records.
//              prototype: unfinished staff previews. hidden-chrome: event tools that render
//              without the site header and footer.
//   hideChrome true when SiteNav and SiteFooter should not render (prefix match, so
//              "/carnegie-2027/team" also covers "/carnegie-2027/team/sign-in").
//   nav        { order, label, profile? } for the main nav.
//   footer     { group, order, label } for the footer columns.
//   sitemap    true to list in sitemap.xml.
//   listed     true to list on /sitemap-page.
//   group      Sub-heading on /sitemap-page inside the public door.
//   internal   Internal working document that is not gated. robots.txt disallows it.
//   instanceOf A concrete page of a dynamic route, e.g. an /info/[slug] page.
//   pending    Page is being built on another branch and may not exist yet.

export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://ashleybands.com").replace(/\/+$/, "");

export const DOORS = ["public", "family", "workspace", "archive", "prototype", "hidden-chrome"];

export const FOOTER_GROUPS = ["The Program", "For Families", "Support the Band", "More"];

// Footer links that live outside this site.
export const EXTERNAL_FOOTER_LINKS = [
  { group: "For Families", order: 5, label: "Band Shirts Store", href: "https://ashleybandshirts.printify.me/" }
];

const INFO = "/info/[slug]";

export const ROUTES = [
  // Public: main pages
  { path: "/this-week", title: "This week", door: "public", nav: { order: 0, label: "This week" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/", title: "Home", door: "public", footer: { group: "The Program", order: 1, label: "Home" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/our-story", title: "Our Story", door: "public", sitemap: true, listed: true, group: "Main pages" },
  { path: "/info/2026-2027-band-information", instanceOf: INFO, title: "2026-2027 Band Information", door: "public", nav: { order: 1, label: "Band Info" }, footer: { group: "The Program", order: 2, label: "2026-2027 Band Information" }, sitemap: true },
  { path: "/info/marching-band-2026", instanceOf: INFO, title: "Marching Band 2026", door: "public", nav: { order: 2, label: "Marching Band" }, footer: { group: "The Program", order: 3, label: "Marching Band 2026" }, sitemap: true },
  { path: "/calendar", title: "Band Calendar", door: "public", nav: { order: 3, label: "Calendar" }, footer: { group: "The Program", order: 4, label: "Band Calendar" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/newsletter", title: "AshleyBands Weekly", door: "public", nav: { order: 4, label: "Weekly" }, footer: { group: "The Program", order: 5, label: "AshleyBands Weekly" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/newsletter/[slug]", title: "AshleyBands Weekly issue", door: "public", sitemap: false },
  { path: "/newsletter/confirm", title: "Confirm AshleyBands Weekly", door: "public", sitemap: false },
  { path: "/newsletter/unsubscribe", title: "AshleyBands Weekly preferences", door: "public", sitemap: false },
  { path: "/handbook", title: "Handbook", door: "public", footer: { group: "The Program", order: 6, label: "Handbook" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/repertoire", title: "Performed Repertoire", door: "public", footer: { group: "The Program", order: 7, label: "Performed Repertoire" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/programs", title: "Concert Programs", door: "public", footer: { group: "The Program", order: 8, label: "Concert Programs" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/mpa-repertoire", title: "MPA Repertoire, South Site 2022 to 2026", door: "public", sitemap: true, listed: true, group: "Main pages" },
  { path: "/assistant", title: "Band Assistant", door: "public", nav: { order: 9, label: "Ask" }, footer: { group: "More", order: 1, label: "Ask the Band Assistant" }, sitemap: true, listed: true, group: "Main pages" },
  { path: "/sitemap-page", title: "Site map", door: "public", footer: { group: "More", order: 2, label: "Site map" }, sitemap: true },
  { path: "/privacy", title: "Privacy Notice", door: "public", footer: { group: "More", order: 3, label: "Privacy Notice" }, sitemap: true, listed: true, group: "Main pages" },
  { path: INFO, title: "Information page", door: "public", sitemap: false },
  { path: "/confirm", title: "Confirm a reply from email", door: "public", sitemap: false },

  // Public: families and students
  { path: "/info/required-items", instanceOf: INFO, title: "Required Items", door: "public", footer: { group: "For Families", order: 3, label: "Required Items" }, sitemap: true },
  { path: "/info/the-band-folder", instanceOf: INFO, title: "Student Resources", door: "public", nav: { order: 8, label: "Student Resources" }, footer: { group: "For Families", order: 4, label: "Student Resources" }, sitemap: true },
  { path: "/practice/ascend", title: "Ascend practice map", door: "public", sitemap: false, listed: true, group: "Practice maps" },
  { path: "/practice/bernstein-tribute", title: "A Bernstein Tribute practice map", door: "public", sitemap: false, listed: true, group: "Practice maps" },
  { path: "/practice/legends-and-heroes", title: "Legends and Heroes practice map", door: "public", sitemap: false, listed: true, group: "Practice maps" },
  { path: "/practice/percussion-ensemble", title: "Percussion Ensemble practice map", door: "public", sitemap: false, listed: true, group: "Practice maps" },
  { path: "/staff-sprint", title: "Staff Sprint (join a race)", door: "public", sitemap: false },
  { path: "/staff-sprint/play/[code]", title: "Staff Sprint race", door: "public", sitemap: false },

  // Public: support the band
  { path: "/sponsors", title: "Become a Sponsor", door: "public", nav: { order: 7, label: "Support" }, footer: { group: "Support the Band", order: 1, label: "Become a Sponsor" }, sitemap: true, listed: true, group: "Support the band" },
  { path: "/info/marching-band-funding", instanceOf: INFO, title: "Marching Band Funding", door: "public", footer: { group: "Support the Band", order: 2, label: "Marching Band Funding" }, sitemap: true },
  { path: "/fundraising", title: "Current Fundraisers", door: "public", nav: { order: 6, label: "Fundraisers" }, footer: { group: "Support the Band", order: 3, label: "Current Fundraisers" }, sitemap: true, listed: true, group: "Support the band" },
  { path: "/fundraising/[slug]", title: "Fundraiser", door: "public", sitemap: false },
  { path: "/boosters", title: "Band Boosters", door: "public", footer: { group: "Support the Band", order: 4, label: "Band Boosters" }, sitemap: true, listed: true, group: "Support the band" },
  { path: "/support-carnegie", title: "Give to the Carnegie Trip", door: "public", sitemap: true, listed: true, group: "Support the band" },
  { path: "/sponsors/give", title: "Give to the Bands of Ashley", door: "public", sitemap: true, listed: true, group: "Support the band" },
  { path: "/sponsors/campaign", title: "Family campaign tools", door: "public", sitemap: false, listed: true, group: "Support the band" },
  { path: "/sponsors/print/packet", title: "Sponsorship packet (print)", door: "public", sitemap: false, listed: true, group: "Support the band" },
  { path: "/sponsors/print/leave-behind", title: "Leave-behind card (print)", door: "public", sitemap: false, listed: true, group: "Support the band" },
  { path: "/sponsors/print/tracker", title: "Family outreach sheet (print)", door: "public", sitemap: false, listed: true, group: "Support the band" },
  { path: "/sponsors/claim-confirm", title: "Confirm a sponsorship", door: "public", sitemap: false },
  { path: "/sponsors/respond", title: "Sponsor thank you", door: "public", sitemap: false },
  { path: "/sponsors/tracker", title: "Family sponsorship (old link)", door: "public", sitemap: false },
  { path: "/support/[code]", title: "Support a student", door: "public", sitemap: false },
  { path: "/support/[code]/carnegie", title: "Support a student's Carnegie trip", door: "public", sitemap: false },
  // Not open yet as of September 2026. Open question for Mr. Parker: is this still coming, or is it done?
  { path: "/spring-trip-refund", title: "Spring trip refund selection", door: "public", sitemap: false },

  // Family portal
  { path: "/portal", title: "Family Portal", door: "family", nav: { order: 5, label: "Family Portal", profile: true }, footer: { group: "For Families", order: 1, label: "Family Portal" }, sitemap: false, listed: true },
  { path: "/portal/request", title: "Request Portal Access", door: "family", footer: { group: "For Families", order: 2, label: "Request Portal Access" }, sitemap: false, listed: true },
  { path: "/portal/request/confirm", title: "Confirm a portal request", door: "family", sitemap: false },
  { path: "/portal/review", title: "Family dashboard", door: "family", sitemap: false },
  { path: "/portal/band-ready/[[...step]]", title: "Band Ready", door: "family", sitemap: false },
  { path: "/portal/carnegie-2027", title: "Carnegie Hall commitment", door: "family", sitemap: false },
  { path: "/portal/carnegie-notes", title: "My Carnegie notes", door: "family", sitemap: false },
  { path: "/portal/carnegie-notes/letter", title: "Write a Carnegie letter", door: "family", sitemap: false },
  { path: "/portal/carnegie-notes/packet/[id]", title: "Carnegie letter packet (print)", door: "family", sitemap: false },
  { path: "/portal/clothing", title: "Clothing order", door: "family", sitemap: false },
  { path: "/portal/onboarding", title: "Student onboarding", door: "family", sitemap: false },
  { path: "/portal/percussion-preferences", title: "Percussion preferences", door: "family", sitemap: false },
  { path: "/portal/sponsorship", title: "Family sponsorship", door: "family", sitemap: false, listed: true },
  { path: "/carnegie-2027/commit", title: "Carnegie Hall 2027 family commitment", door: "family", sitemap: false, listed: true },

  // Archive: past events and records. Each shows an archived notice.
  { path: "/carnegie-2027/meeting-packet", title: "Carnegie Hall 2027 family meeting packet (September 1, 2026)", door: "archive", sitemap: true, listed: true },
  { path: "/meetings/2026-09-01", title: "September 1, 2026 booster meeting slides", door: "archive", sitemap: false, listed: true },
  { path: "/boosters/minutes/2026-05-29", title: "Booster meeting minutes, May 29, 2026", door: "archive", sitemap: false, listed: true },
  { path: "/open-house", title: "Open House Band Ready Challenge (August 2026)", door: "archive", sitemap: false, listed: true },
  { path: "/marching-band-signup-2026", title: "2026 marching band sign-up (closed)", door: "archive", sitemap: false, listed: true },
  { path: "/programs/spring-concert-2026", title: "Spring Concert 2026 program", door: "archive", sitemap: true, listed: true },
  { path: "/spring-trip-recovery", title: "Spring Trip 2026 recovery updates", door: "archive", sitemap: false, listed: true },
  { path: "/band-of-heroes", title: "Band of Heroes live display (June 2026)", door: "archive", sitemap: false },
  { path: "/band-of-heroes/vote", title: "Band of Heroes audience vote (June 2026)", door: "archive", sitemap: false },
  { path: "/band-of-heroes/control", title: "Band of Heroes control (June 2026)", door: "archive", sitemap: false },
  // Internal briefs. Not gated, so robots.txt disallows them and they stay off the public map.
  // Open question for Mr. Parker: gate them behind staff sign-in, or take them down.
  { path: "/raleigh-brief", title: "Student brief, NC General Assembly (May 2026)", door: "archive", internal: true, hideChrome: true, sitemap: false },
  { path: "/day-1-agenda", title: "Band camp Day 1 working agenda", door: "archive", internal: true, hideChrome: true, sitemap: false },
  { path: "/leadership-brief", title: "Regiment OS leadership brief", door: "archive", internal: true, sitemap: false },
  { path: "/mpa-analysis", title: "2026 NC MPA analysis", door: "archive", internal: true, sitemap: false },

  // Event tools without site chrome
  { path: "/attendance", title: "Program attendance", door: "hidden-chrome", hideChrome: true, sitemap: false },
  { path: "/regiment-os", title: "Regiment OS review", door: "hidden-chrome", hideChrome: true, sitemap: false },
  { path: "/carnegie-2027/team", title: "Carnegie workspace", door: "hidden-chrome", hideChrome: true, sitemap: false },
  { path: "/carnegie-2027/team/sign-in", title: "Carnegie workspace sign-in", door: "hidden-chrome", hideChrome: true, sitemap: false },

  // Staff workspace
  { path: "/admin", title: "Staff hub", door: "workspace", footer: { group: "More", order: 4, label: "Staff Sign-In" }, sitemap: false },
  { path: "/admin/assets", title: "Assets", door: "workspace", sitemap: false },
  { path: "/admin/attendance", title: "Attendance", door: "workspace", sitemap: false },
  { path: "/admin/billing", title: "Student billing", door: "workspace", sitemap: false },
  { path: "/admin/broadcast", title: "Broadcast", door: "workspace", sitemap: false },
  { path: "/admin/carnegie-2027", title: "Carnegie commitment sheet", door: "workspace", sitemap: false },
  { path: "/admin/carnegie-letters", title: "Carnegie letters", door: "workspace", sitemap: false },
  { path: "/admin/clothing-orders", title: "Clothing orders", door: "workspace", sitemap: false },
  { path: "/admin/contacts", title: "Contacts", door: "workspace", sitemap: false },
  { path: "/admin/data-inventory", title: "Data inventory", door: "workspace", sitemap: false },
  { path: "/admin/ensembles", title: "Ensembles", door: "workspace", sitemap: false },
  { path: "/admin/financial", title: "Financial", door: "workspace", sitemap: false },
  { path: "/admin/forms", title: "Forms", door: "workspace", sitemap: false },
  { path: "/admin/instrument-inventory", title: "Instrument inventory review", door: "workspace", sitemap: false },
  { path: "/admin/marching-band", title: "Marching band dashboard", door: "workspace", sitemap: false },
  { path: "/admin/marching-band/funding", title: "Marching band funding", door: "workspace", sitemap: false },
  { path: "/admin/measurements", title: "Measurements", door: "workspace", sitemap: false },
  { path: "/admin/music-library", title: "Music library review", door: "workspace", sitemap: false },
  { path: "/admin/newsletter", title: "AshleyBands Weekly (staff)", door: "workspace", sitemap: false },
  { path: "/admin/percussion-preferences", title: "Percussion preferences", door: "workspace", sitemap: false },
  { path: "/admin/practice-loop", title: "Practice loop", door: "workspace", sitemap: false },
  { path: "/admin/profile-requests", title: "Profile requests", door: "workspace", sitemap: false },
  { path: "/admin/sizes", title: "Sizes", door: "workspace", sitemap: false },
  { path: "/admin/students", title: "Students", door: "workspace", sitemap: false },
  { path: "/admin/students/manage", title: "Add or edit a student", door: "workspace", sitemap: false },
  { path: "/admin/system", title: "System", door: "workspace", sitemap: false },
  { path: "/sponsors/dashboard", title: "Sponsor dashboard", door: "workspace", sitemap: false },
  { path: "/sponsors/dashboard/businesses", title: "Business outreach dashboard", door: "workspace", sitemap: false },
  { path: "/sponsors/team", title: "Campaign research", door: "workspace", sitemap: false },
  { path: "/staff-sprint/teacher", title: "Staff Sprint teacher view", door: "workspace", sitemap: false },
  { path: "/instrument-inventory", title: "Instrument inventory (staff entry)", door: "workspace", sitemap: false },
  { path: "/music-library", title: "Music library (staff entry)", door: "workspace", sitemap: false },

  // Prototypes
  { path: "/admin/assets-inventory-prototype", title: "Assets inventory prototype", door: "prototype", sitemap: false },
  { path: "/admin/attendance-workspace-prototype", title: "Attendance workspace prototype", door: "prototype", sitemap: false },
  { path: "/admin/current-students-prototype", title: "Current students prototype", door: "prototype", sitemap: false },
  { path: "/admin/ensembles-memberships-prototype", title: "Ensembles and memberships prototype", door: "prototype", sitemap: false },
  { path: "/admin/operations-prototype", title: "Operations prototype", door: "prototype", sitemap: false },
  { path: "/portal/onboarding-prototype", title: "Student onboarding prototype", door: "prototype", sitemap: false }
];

// True when `pathname` is `base` or sits under it.
export function matchesPrefix(pathname, base) {
  if (!pathname) return false;
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

export const HIDDEN_CHROME_PATHS = ROUTES.filter((route) => route.hideChrome).map((route) => route.path);

// Pages that render without SiteNav and SiteFooter. Prefix-aware.
export function hidesSiteChrome(pathname) {
  return HIDDEN_CHROME_PATHS.some((base) => matchesPrefix(pathname, base));
}

export const NAV_LINKS = ROUTES.filter((route) => route.nav)
  .sort((a, b) => a.nav.order - b.nav.order)
  .map((route) => ({ href: route.path, label: route.nav.label, ...(route.nav.profile ? { profile: true } : {}) }));

export const FOOTER_COLUMNS = FOOTER_GROUPS.map((heading) => ({
  heading,
  links: [
    ...ROUTES.filter((route) => route.footer?.group === heading).map((route) => ({
      href: route.path,
      label: route.footer.label,
      order: route.footer.order
    })),
    ...EXTERNAL_FOOTER_LINKS.filter((link) => link.group === heading).map((link) => ({ ...link, external: true }))
  ]
    .sort((a, b) => a.order - b.order)
    .map(({ href, label, external }) => ({ href, label, ...(external ? { external: true } : {}) }))
}));

export function routesByDoor(door) {
  return ROUTES.filter((route) => route.door === door);
}

// Path prefixes robots.txt disallows. /admin, /api and /portal cover their whole trees.
export function robotsDisallowPaths() {
  const covered = ["/admin", "/api", "/portal"];
  const extra = ROUTES.filter(
    (route) =>
      (route.door === "prototype" || route.door === "workspace" || route.door === "hidden-chrome" || route.internal) &&
      !covered.some((base) => matchesPrefix(route.path, base))
  ).map((route) => route.path.replace(/\/\[.*$/, ""));
  const all = [...new Set([...covered, ...extra])];
  return all.filter((path) => !all.some((base) => base !== path && matchesPrefix(path, base)));
}

// Routes for sitemap.xml: public and archive routes marked sitemap: true, never dynamic
// patterns, internal briefs or pages still pending. Portal pages stay out because robots.txt
// disallows /portal.
export function sitemapRoutes() {
  return ROUTES.filter(
    (route) =>
      route.sitemap &&
      !route.pending &&
      !route.internal &&
      !route.path.includes("[") &&
      ["public", "archive"].includes(route.door)
  );
}
