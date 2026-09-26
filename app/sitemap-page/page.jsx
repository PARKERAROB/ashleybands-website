import Link from "next/link";
import { getCurrentFundraisers, getSiteData } from "@/lib/siteData";

export const metadata = {
  title: "Site map | Bands of AHS"
};

export default function SitemapPage() {
  const data = getSiteData();
  const currentFundraisers = getCurrentFundraisers();
  const endedFundraisers = data.fundraisers.filter(
    (fundraiser) => !currentFundraisers.some((current) => current.slug === fundraiser.slug)
  );

  const sections = [
    { label: "Current Information", category: "Current information" },
    { label: "Everyday Resources", category: "Everyday resources" },
    { label: "Support the Band", category: "Support the band" },
    { label: "Archive (past activities)", category: "Archive" }
  ];

  const mainPages = [
    { title: "Home", href: "/" },
    { title: "Our Story", href: "/our-story" },
    { title: "Band Calendar", href: "/calendar" },
    { title: "AshleyBands Weekly", href: "/newsletter" },
    { title: "Band Boosters", href: "/boosters" },
    { title: "Current Fundraisers", href: "/fundraising" },
    ...currentFundraisers.map((fundraiser) => ({ title: fundraiser.title, href: `/fundraising/${fundraiser.slug}` })),
    { title: "Give to the Carnegie Trip", href: "/support-carnegie" },
    { title: "Family Portal", href: "/portal" },
    { title: "Carnegie Hall 2027 Family Commitment", href: "/carnegie-2027/commit" },
    { title: "Carnegie Hall 2027 Family Meeting Packet", href: "/carnegie-2027/meeting-packet" },
    { title: "Request Portal Access", href: "/portal/request" },
    { title: "Performed Repertoire", href: "/repertoire" },
    { title: "Program Archive", href: "/programs" },
    { title: "Spring Concert 2026 Program", href: "/programs/spring-concert-2026" },
    { title: "Handbook", href: "/handbook" },
    { title: "Band Assistant", href: "/assistant" }
  ];

  // Past activities that are not info pages. They stay reachable for old links (#123).
  const archiveExtras = [
    { title: "Spring Trip Recovery", href: "/spring-trip-recovery" },
    ...endedFundraisers.map((fundraiser) => ({ title: `${fundraiser.title} (ended)`, href: `/fundraising/${fundraiser.slug}` }))
  ];

  const sponsorPages = [
    { title: "Become a Sponsor", href: "/sponsors" },
    { title: "Family Campaign Tools", href: "/sponsors/campaign" },
    { title: "Sponsorship Tracker", href: "/sponsors/tracker" },
    { title: "Sponsorship Packet (print)", href: "/sponsors/print/packet" },
    { title: "Leave-Behind Card (print)", href: "/sponsors/print/leave-behind" },
    { title: "Tracker Sheet (print)", href: "/sponsors/print/tracker" }
  ];

  const staffPages = [
    { title: "Staff Hub (all dashboards)", href: "/admin" },
    { title: "Broadcast (email families)", href: "/admin/broadcast" },
    { title: "AshleyBands Weekly (draft, publish, send)", href: "/admin/newsletter" },
    { title: "Student Billing", href: "/admin/billing" },
    { title: "Carnegie Commitment Sheet", href: "/admin/carnegie-2027" },
    { title: "Add / Edit Student", href: "/admin/students" },
    { title: "Profile Requests", href: "/admin/profile-requests" },
    { title: "Marching Band Dashboard", href: "/admin/marching-band" },
    { title: "Instrument Inventory (review)", href: "/admin/instrument-inventory" },
    { title: "Music Library (review)", href: "/admin/music-library" },
    { title: "Sponsor Dashboard", href: "/sponsors/dashboard" },
    { title: "Business Outreach Dashboard", href: "/sponsors/dashboard/businesses" },
    { title: "Staff Sprint", href: "/staff-sprint" },
    { title: "Staff Sprint - Teacher View", href: "/staff-sprint/teacher" },
    { title: "Instrument Inventory (staff entry)", href: "/instrument-inventory" },
    { title: "Music Library (staff entry)", href: "/music-library" }
  ];

  return (
    <main className="narrow-page">
      <p className="eyebrow">Navigation</p>
      <h1>Site map</h1>
      <p className="lede">The main pages on the Bands of Ashley High School website.</p>

      <section className="sitemap-section">
        <h2>Main Pages</h2>
        <ul className="sitemap-list">
          {mainPages.map((page) => (
            <li key={page.href}>
              <Link href={page.href}>{page.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      {sections.map((section) => {
        const pages = data.pages.filter((p) => p.category === section.category);
        return (
          <section className="sitemap-section" key={section.category}>
            <h2>{section.label}</h2>
            <ul className="sitemap-list">
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/info/${page.slug}`}>{page.title}</Link>
                  <span className="sitemap-summary">{page.summary}</span>
                </li>
              ))}
              {section.category === "Archive"
                ? archiveExtras.map((page) => (
                    <li key={page.href}>
                      <Link href={page.href}>{page.title}</Link>
                    </li>
                  ))
                : null}
            </ul>
          </section>
        );
      })}

      <section className="sitemap-section">
        <h2>Sponsorship Tools &amp; Print</h2>
        <ul className="sitemap-list">
          {sponsorPages.map((page) => (
            <li key={page.href}>
              <Link href={page.href}>{page.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="sitemap-section">
        <h2>Staff / Internal</h2>
        <p className="sitemap-summary">For staff and volunteers. Most of these pages need a staff sign-in.</p>
        <ul className="sitemap-list">
          {staffPages.map((page) => (
            <li key={page.href}>
              <Link href={page.href}>{page.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
