import Link from "next/link";
import { getCurrentFundraisers, getSiteData } from "@/lib/siteData";
import { routesByDoor } from "@/lib/routes";

export const metadata = {
  title: "Site map | Bands of AHS"
};

// Built from the route registry in lib/routes.js (#133), grouped by who each page is for.
// Info pages and fundraisers come from content, so new ones appear here without a code change.
function PageList({ pages }) {
  return (
    <ul className="sitemap-list">
      {pages.map((page) => (
        <li key={page.href}>
          <Link href={page.href}>{page.title}</Link>
          {page.summary ? <span className="sitemap-summary">{page.summary}</span> : null}
        </li>
      ))}
    </ul>
  );
}

const listed = (door) =>
  routesByDoor(door)
    .filter((route) => route.listed && !route.pending)
    .map((route) => ({ title: route.title, href: route.path, group: route.group }));

export default function SitemapPage() {
  const data = getSiteData();
  const currentFundraisers = getCurrentFundraisers();
  const endedFundraisers = data.fundraisers.filter(
    (fundraiser) => !currentFundraisers.some((current) => current.slug === fundraiser.slug)
  );
  const infoPages = (category) =>
    data.pages
      .filter((page) => page.category === category)
      .map((page) => ({ title: page.title, href: `/info/${page.slug}`, summary: page.summary }));

  const publicPages = listed("public");
  const byGroup = (group) => publicPages.filter((page) => page.group === group);

  const publicSections = [
    { label: "Main pages", pages: byGroup("Main pages") },
    { label: "Current information", pages: infoPages("Current information") },
    { label: "Everyday resources", pages: infoPages("Everyday resources") },
    { label: "Practice maps", pages: byGroup("Practice maps") },
    {
      label: "Support the band",
      pages: [
        ...byGroup("Support the band"),
        ...currentFundraisers.map((fundraiser) => ({ title: fundraiser.title, href: `/fundraising/${fundraiser.slug}` })),
        ...infoPages("Support the band")
      ]
    }
  ];

  const archivePages = [
    ...listed("archive"),
    ...infoPages("Archive"),
    ...endedFundraisers.map((fundraiser) => ({ title: `${fundraiser.title} (ended)`, href: `/fundraising/${fundraiser.slug}` }))
  ];

  return (
    <main className="narrow-page">
      <p className="eyebrow">Navigation</p>
      <h1>Site map</h1>
      <p className="lede">Every page for families, students and supporters, grouped by who it is for.</p>

      {publicSections.map((section) =>
        section.pages.length ? (
          <section className="sitemap-section" key={section.label}>
            <h2>{section.label}</h2>
            <PageList pages={section.pages} />
          </section>
        ) : null
      )}

      <section className="sitemap-section">
        <h2>Family Portal</h2>
        <p className="sitemap-summary">Most portal pages open after you sign in with your family email.</p>
        <PageList pages={listed("family")} />
      </section>

      <section className="sitemap-section">
        <h2>Archive (past events)</h2>
        <p className="sitemap-summary">Records of past events. Dates and deadlines on these pages have passed.</p>
        <PageList pages={archivePages} />
      </section>

      <section className="sitemap-section">
        <h2>Staff workspace (sign-in required)</h2>
        <PageList pages={[{ title: "Staff sign-in", href: "/admin" }]} />
      </section>
    </main>
  );
}
