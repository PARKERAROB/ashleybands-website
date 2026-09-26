// Route registry guard (#133). Every app/**/page.jsx must have an entry in lib/routes.js,
// and every registry entry must point at a real page (or a real /info slug).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOORS,
  FOOTER_COLUMNS,
  NAV_LINKS,
  ROUTES,
  hidesSiteChrome,
  robotsDisallowPaths,
  sitemapRoutes
} from "../lib/routes.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(root, "app");
const PAGE_FILE = /^page\.(jsx|js|tsx|ts|mdx)$/;

function findPages(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Private folders (_x) never become routes.
      if (!entry.name.startsWith("_")) found.push(...findPages(full));
    } else if (PAGE_FILE.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function routeFromFile(file) {
  const segments = relative(appDir, dirname(file))
    .split(sep)
    .filter(Boolean)
    // Route groups "(name)" and parallel slots "@name" do not appear in the URL.
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));
  return `/${segments.join("/")}`;
}

const pageRoutes = new Set(findPages(appDir).map(routeFromFile));
const registered = ROUTES.filter((route) => !route.instanceOf);
const registeredPaths = new Set(registered.map((route) => route.path));
const siteData = JSON.parse(readFileSync(join(root, "content", "site-data.json"), "utf8"));

test("every app page route is in the registry", () => {
  const missing = [...pageRoutes].filter((path) => !registeredPaths.has(path)).sort();
  assert.deepEqual(missing, [], `Add these routes to lib/routes.js: ${missing.join(", ")}`);
});

test("every registry entry points at a page that exists", () => {
  const stale = registered
    .filter((route) => !route.pending && !pageRoutes.has(route.path))
    .map((route) => route.path);
  assert.deepEqual(stale, [], `These registry paths have no app/**/page.jsx: ${stale.join(", ")}`);
});

test("pending entries are the only ones allowed to be missing", () => {
  for (const route of ROUTES.filter((entry) => entry.pending)) {
    if (pageRoutes.has(route.path)) {
      console.log(`note: ${route.path} now exists; remove pending: true from lib/routes.js`);
    }
  }
  assert.ok(true);
});

test("instance entries name a registered dynamic route and a real content slug", () => {
  const slugs = new Set((siteData.pages || []).map((page) => page.slug));
  for (const route of ROUTES.filter((entry) => entry.instanceOf)) {
    assert.ok(registeredPaths.has(route.instanceOf), `${route.path}: ${route.instanceOf} is not registered`);
    if (route.instanceOf === "/info/[slug]") {
      const slug = route.path.replace(/^\/info\//, "");
      assert.ok(slugs.has(slug), `${route.path}: no content page with slug "${slug}"`);
    }
  }
});

test("registry entries are well formed and unique", () => {
  const seen = new Set();
  for (const route of ROUTES) {
    assert.ok(!seen.has(route.path), `duplicate registry path ${route.path}`);
    seen.add(route.path);
    assert.ok(DOORS.includes(route.door), `${route.path}: unknown door "${route.door}"`);
    assert.equal(typeof route.title, "string", `${route.path}: title`);
    assert.ok(route.title.length > 0, `${route.path}: title`);
    assert.equal(typeof route.sitemap, "boolean", `${route.path}: sitemap must be true or false`);
    assert.ok(!/—/.test(route.title), `${route.path}: no em dashes in titles`);
    if (route.door === "hidden-chrome") assert.equal(route.hideChrome, true, `${route.path}: hidden-chrome door must hide chrome`);
  }
});

test("hidden-chrome matching is prefix-aware", () => {
  assert.equal(hidesSiteChrome("/carnegie-2027/team"), true);
  assert.equal(hidesSiteChrome("/carnegie-2027/team/sign-in"), true);
  assert.equal(hidesSiteChrome("/attendance"), true);
  assert.equal(hidesSiteChrome("/carnegie-2027/commit"), false);
  assert.equal(hidesSiteChrome("/attendance-report"), false);
  assert.equal(hidesSiteChrome("/"), false);
});

test("nav keeps its order with This week first", () => {
  assert.deepEqual(
    NAV_LINKS.map((link) => link.label),
    ["This week", "Band Info", "Marching Band", "Calendar", "Weekly", "Family Portal", "Fundraisers", "Support", "Student Resources", "Ask"]
  );
  assert.equal(NAV_LINKS.find((link) => link.label === "Family Portal").profile, true);
});

test("footer columns resolve to registered or external links", () => {
  for (const column of FOOTER_COLUMNS) {
    assert.ok(column.links.length > 0, `${column.heading} is empty`);
    for (const link of column.links) {
      if (link.external) assert.match(link.href, /^https:\/\//);
      else assert.ok(ROUTES.some((route) => route.path === link.href), `${link.href} not in registry`);
    }
  }
});

test("robots and sitemap never expose staff, portal, prototype or internal routes", () => {
  const disallowed = robotsDisallowPaths();
  for (const base of ["/admin", "/api", "/portal", "/leadership-brief", "/mpa-analysis", "/raleigh-brief"]) {
    assert.ok(disallowed.includes(base), `robots.txt should disallow ${base}`);
  }
  for (const route of sitemapRoutes()) {
    assert.ok(["public", "archive"].includes(route.door), `${route.path} is ${route.door}`);
    assert.ok(!route.internal && !route.path.includes("["), route.path);
    assert.ok(!disallowed.some((base) => route.path === base || route.path.startsWith(`${base}/`)), `${route.path} is disallowed`);
  }
});

test("app/members stays deleted; next.config redirects it", () => {
  assert.equal(existsSync(join(appDir, "members")), false);
});
