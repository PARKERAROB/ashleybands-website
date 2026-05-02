import PageCard from "@/components/PageCard";
import MarkdownBlock from "@/components/MarkdownBlock";
import { getSiteData } from "@/lib/siteData";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  const data = getSiteData();
  const groups = [
    {
      category: "Current information",
      eyebrow: "What is happening now"
    },
    {
      category: "Everyday resources",
      eyebrow: "What students need"
    },
    {
      category: "Support the band",
      eyebrow: "Donations and sponsors"
    }
  ].map((group) => ({
    ...group,
    pages: data.pages.filter((page) => page.category === group.category)
  }));

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Eugene Ashley High School</p>
          <h1>Bands of Ashley High School</h1>
          <p>
            Public information, family resources, calendar links, and quick answers for the Ashley Band community.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/assistant">Ask the Band Assistant</a>
            <Link className="button secondary" href="/info/the-band-folder">Open The Band Folder</Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="Program snapshot">
          <Image src="/bandsofahslogo.png" alt="" width={76} height={76} />
          <MarkdownBlock markdown={data.program.overview} />
        </div>
      </section>

      {groups.map((group) => (
        <section className="section" key={group.category}>
          <div className="section-heading">
            <p className="eyebrow">{group.eyebrow}</p>
            <h2>{group.category}</h2>
          </div>
          <div className="card-grid">
            {group.pages.map((page) => (
              <PageCard key={page.slug} page={page} />
            ))}
          </div>
        </section>
      ))}

      <section className="split-section">
        <div>
          <p className="eyebrow">Official Dates</p>
          <h2>Calendar</h2>
          <p>
            The band calendar remains the source of truth for dates and times. Subscribe instead of downloading a
            one-time copy so updates appear automatically.
          </p>
          <a className="text-link" href={data.quickLinks[0].href}>Calendar subscription link</a>
        </div>
        <div>
          <p className="eyebrow">Payments and Records</p>
          <h2>My Music Office</h2>
          <p>
            MMO is used for student information, parent contact information, financial accounts, equipment records,
            band communication, and calendar access.
          </p>
          <a className="text-link" href={data.quickLinks[1].href}>Open My Music Office</a>
        </div>
        <div>
          <p className="eyebrow">Spirit Wear</p>
          <h2>Band Shirts Store</h2>
          <p>
            The official Red Band Shirt is required for all band members and used for pep rallies, community
            performances, parades, and informal events.
          </p>
          <a className="text-link" href={data.quickLinks[3].href}>Open Band Shirts Store</a>
        </div>
      </section>
    </main>
  );
}
