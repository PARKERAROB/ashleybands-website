"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import HomeUpcomingEvents from "@/components/HomeUpcomingEvents";
import NewsletterSignup from "@/components/NewsletterSignup";
import { getSiteData } from "@/lib/siteData";

const PROMPTS = [
  "Where can I find upcoming band dates?",
  "What do students need for band?",
  "How do I subscribe to the calendar?",
  "How does the Carnegie conditional deposit work?"
];

const INFO_GROUPS = [
  { category: "Current information", eyebrow: "What is happening now" },
  { category: "Everyday resources", eyebrow: "What students need" }
];

export default function HomePage() {
  const data = getSiteData();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const bandShirtsStore = data.quickLinks.find((link) => link.label === "Band Shirts Store");
  const groups = INFO_GROUPS.map((group) => ({
    ...group,
    pages: data.pages.filter((page) => page.category === group.category)
  }));
  const sponsorshipPages = data.pages.filter((page) => page.category === "Support the band");

  function handleSubmit(event) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/assistant?q=${encodeURIComponent(q)}`);
  }

  function handlePrompt(prompt) {
    router.push(`/assistant?q=${encodeURIComponent(prompt)}`);
  }

  return (
    <main className="home">
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <h1 id="home-hero-title" className="home-wordmark">
            <span className="home-wordmark-the">The Bands of</span>
            <span className="home-wordmark-name">Ashley High School</span>
          </h1>
          <p className="home-hero-ensembles">
            Concert Bands · Marching Band · Percussion · Jazz · Colorguard · Pep Band
          </p>
          <p className="home-hero-place">Wilmington, North Carolina</p>
          <div className="home-hero-actions">
            <Link className="home-btn home-btn-primary" href="/portal">Open Family Portal</Link>
            <Link className="home-btn home-btn-secondary" href="/calendar">Band Calendar</Link>
          </div>
          <p className="home-hero-note">
            Families review contacts, student details, forms, and payment records in the portal.
          </p>
        </div>
        <figure className="home-hero-photo">
          <Image
            src="/656637421_1325880026241163_8640066925134763727_n.jpg"
            alt="Ashley High School Wind Ensemble on stage"
            fill
            sizes="(max-width: 900px) 100vw, 55vw"
            style={{ objectFit: "cover", objectPosition: "center 40%" }}
            priority
          />
          <figcaption>
            <span>Ashley High School Wind Ensemble</span>
            <span>Robert A. Parker, Director</span>
          </figcaption>
        </figure>
      </section>

      <section className="home-now" aria-labelledby="home-now-title">
        <div className="home-container home-now-grid">
          <div className="home-now-actions">
            <div className="home-heading">
              <p className="eyebrow">For students and families</p>
              <h2 id="home-now-title">Start here.</h2>
            </div>
            <ul className="home-now-list">
              <li className="home-now-item">
                <p className="home-now-tag">Requested by September 4</p>
                <h3>Carnegie Hall 2027</h3>
                <p>
                  Share your family’s response and deposit choice. Already completed the $50 deposit?
                  Review your record in the portal.
                </p>
                <div className="home-links">
                  <Link href="/carnegie-2027/commit">Family commitment</Link>
                  <Link href="/info/carnegie-2027">Current trip information</Link>
                </div>
              </li>
              <li className="home-now-item">
                <p className="home-now-tag">Ways to help</p>
                <h3>Current fundraisers</h3>
                <p>Campaign dates, student-credit instructions, and links to share with friends and family.</p>
                <ul className="home-fundraisers">
                  {data.fundraisers.map((fundraiser) => (
                    <li key={fundraiser.slug}>
                      <Link href={`/fundraising/${fundraiser.slug}`}>{fundraiser.title}</Link>
                      <span>{fundraiser.timing || fundraiser.status}</span>
                    </li>
                  ))}
                </ul>
                <div className="home-links">
                  <Link href="/fundraising">All current fundraisers</Link>
                </div>
              </li>
              <li className="home-now-item">
                <p className="home-now-tag">Program news</p>
                <h3>AshleyBands Weekly</h3>
                <p>Student accomplishments, the week ahead, and what families need to know.</p>
                <div className="home-links">
                  <Link href="/newsletter">Read the latest issue</Link>
                </div>
              </li>
            </ul>
          </div>
          <HomeUpcomingEvents />
        </div>
      </section>

      <section className="home-ask" aria-labelledby="home-ask-title">
        <Image
          src="/528048622_10108973219927428_7681318735311321118_n.jpg"
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 40%" }}
          className="home-ask-bg"
        />
        <div className="home-container home-ask-inner">
          <p className="eyebrow">Band Assistant</p>
          <h2 id="home-ask-title">Have a question? Ask.</h2>
          <p className="home-ask-sub">
            Dates, attire, trips, marching band, and more. The assistant uses public Ashley Bands information only.
          </p>
          <form className="home-ask-form" onSubmit={handleSubmit}>
            <input
              className="home-ask-input"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask a question about Ashley Bands..."
              aria-label="Question about Ashley Bands"
              autoComplete="off"
            />
            <button className="home-ask-btn" type="submit" aria-label="Ask">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
          <div className="home-ask-prompts">
            {PROMPTS.map((prompt) => (
              <button key={prompt} className="home-ask-pill" type="button" onClick={() => handlePrompt(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="home-info" aria-labelledby="home-info-title">
        <div className="home-container">
          <div className="home-heading">
            <p className="eyebrow">Program information</p>
            <h2 id="home-info-title">The pages families use most.</h2>
          </div>
          <div className="home-info-groups">
            {groups.map((group) => (
              <div className="home-info-group" key={group.category}>
                <p className="home-now-tag">{group.eyebrow}</p>
                <h3>{group.category}</h3>
                <ul className="home-info-list">
                  {group.pages.map((page) => (
                    <li key={page.slug}>
                      <Link href={`/info/${page.slug}`}>
                        <span className="home-info-audience">{page.audience}</span>
                        <strong>{page.title}</strong>
                        <span className="home-info-summary">{page.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-story" aria-labelledby="home-story-title">
        <div className="home-container home-story-grid">
          <div className="home-story-photo">
            <Image
              src="/567638942_18535699147058878_8482643743523406198_n.jpg"
              alt="Ashley marching band students with trophies"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
          <div className="home-story-copy">
            <p className="eyebrow">Screaming Eagle Regiment</p>
            <h2 id="home-story-title">A program that competes and wins.</h2>
            <p>
              Our students invest hundreds of hours each season in rehearsal, performance, and competition.
              The results show.
            </p>
            <div className="home-links home-links-light">
              <Link href="/info/marching-band-2026">Marching Band 2026</Link>
              <Link href="/programs">Concert programs</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-support" aria-labelledby="home-support-title">
        <div className="home-container">
          <div className="home-heading">
            <p className="eyebrow">Donations and sponsors</p>
            <h2 id="home-support-title">Support the band.</h2>
          </div>
          <div className="home-support-grid">
            {sponsorshipPages.map((page) => (
              <Link className="home-support-card" href={`/info/${page.slug}`} key={page.slug}>
                <span className="home-info-audience">{page.audience}</span>
                <strong>{page.title}</strong>
                <span className="home-info-summary">{page.summary}</span>
              </Link>
            ))}
            <Link className="home-support-card" href="/boosters">
              <span className="home-info-audience">Families</span>
              <strong>Band Boosters</strong>
              <span className="home-info-summary">How families take part and where to reach the boosters.</span>
            </Link>
            {bandShirtsStore && (
              <a className="home-support-card" href={bandShirtsStore.href} target="_blank" rel="noreferrer">
                <span className="home-info-audience">Spirit wear</span>
                <strong>Band Shirts Store ↗</strong>
                <span className="home-info-summary">
                  The official Red Band Shirt is required for all band members and used for pep rallies,
                  community performances, parades, and informal events.
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="home-newsletter" aria-labelledby="home-newsletter-title">
        <div className="home-newsletter-copy">
          <p className="eyebrow">Sundays from Ashley Bands</p>
          <h2 id="home-newsletter-title">The week behind us. The week ahead.</h2>
          <p>
            AshleyBands Weekly shares student accomplishments, upcoming dates, and the few things students and
            families need to do next.
          </p>
          <Link className="text-link" href="/newsletter">Read AshleyBands Weekly</Link>
        </div>
        <div className="home-newsletter-form">
          <h3>Parents, alumni, and friends</h3>
          <p>Subscribe to the public edition. Current students and families receive the member edition separately.</p>
          <NewsletterSignup compact />
        </div>
      </section>
    </main>
  );
}
