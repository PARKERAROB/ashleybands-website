import Link from "next/link";
import { getSiteData } from "@/lib/siteData";

export const metadata = {
  title: "Site Map | Bands of AHS"
};

export default function SitemapPage() {
  const data = getSiteData();

  const sections = [
    { label: "Current Information", category: "Current information" },
    { label: "Everyday Resources", category: "Everyday resources" },
    { label: "Support the Band", category: "Support the band" }
  ];

  const mainPages = [
    { title: "Home", href: "/" },
    { title: "Band Calendar", href: "/calendar" },
    { title: "Band Boosters", href: "/boosters" },
    { title: "Family Profile", href: "/portal" },
    { title: "Request Profile Access", href: "/portal/request" },
    { title: "Performed Repertoire", href: "/repertoire" },
    { title: "Program Archive", href: "/programs" },
    { title: "Spring Concert 2026 Program", href: "/programs/spring-concert-2026" },
    { title: "Handbook", href: "/handbook" },
    { title: "Marching Band Sign-Up", href: "/marching-band-signup-2026" },
    { title: "Spring Trip Recovery", href: "/spring-trip-recovery" },
    { title: "Band Assistant", href: "/assistant" },
    { title: "Instrument Inventory (submit)", href: "/instrument-inventory" },
    { title: "Music Library (submit)", href: "/music-library" }
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
    { title: "Student Billing", href: "/admin/billing" },
    { title: "Add / Edit Student", href: "/admin/students" },
    { title: "Profile Requests", href: "/admin/profile-requests" },
    { title: "Marching Band Dashboard", href: "/admin/marching-band" },
    { title: "Instrument Inventory (review)", href: "/admin/instrument-inventory" },
    { title: "Music Library (review)", href: "/admin/music-library" },
    { title: "Sponsor Dashboard", href: "/sponsors/dashboard" },
    { title: "Business Outreach Dashboard", href: "/sponsors/dashboard/businesses" },
    { title: "Staff Sprint", href: "/staff-sprint" },
    { title: "Staff Sprint - Teacher View", href: "/staff-sprint/teacher" },
    { title: "Raleigh Brief", href: "/raleigh-brief" }
  ];

  return (
    <main className="narrow-page">
      <p className="eyebrow">Navigation</p>
      <h1>Site Map</h1>
      <p className="lede">Every page on the Bands of Ashley High School website.</p>

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
        <p className="sitemap-summary">Sign-in required. Listed for quick access.</p>
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
