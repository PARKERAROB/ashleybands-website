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

  const staticPages = [
    { title: "Home", href: "/" },
    { title: "Performed Repertoire", href: "/repertoire" },
    { title: "Program Archive", href: "/programs" },
    { title: "Band Assistant", href: "/assistant" },
    { title: "Member Area", href: "/members" }
  ];

  return (
    <main className="narrow-page">
      <p className="eyebrow">Navigation</p>
      <h1>Site Map</h1>
      <p className="lede">Every page on the Bands of Ashley High School website.</p>

      <section className="sitemap-section">
        <h2>Main Pages</h2>
        <ul className="sitemap-list">
          {staticPages.map((page) => (
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
    </main>
  );
}
