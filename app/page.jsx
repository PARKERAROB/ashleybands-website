"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageCard from "@/components/PageCard";
import HomeUpcomingEvents from "@/components/HomeUpcomingEvents";
import { getSiteData } from "@/lib/siteData";
import Image from "next/image";
import Link from "next/link";
import NewsletterSignup from "@/components/NewsletterSignup";

const PROMPTS = [
  "Where can I find upcoming band dates?",
  "What do students need for band?",
  "How do I subscribe to the calendar?",
  "How does the Carnegie conditional deposit work?"
];

export default function HomePage() {
  const data = getSiteData();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/assistant?q=${encodeURIComponent(q)}`);
  }

  function handlePrompt(prompt) {
    router.push(`/assistant?q=${encodeURIComponent(prompt)}`);
  }

  const groups = [
    { category: "Current information", eyebrow: "What is happening now" },
    { category: "Everyday resources", eyebrow: "What students need" },
    { category: "Support the band", eyebrow: "Donations and sponsors" }
  ].map((group) => ({
    ...group,
    pages: data.pages.filter((page) => page.category === group.category)
  }));

  return (
    <main>
      <section className="home-masthead">
        <h1 className="home-masthead-headline">
          <span className="home-masthead-the">The Bands of</span>
          <span className="home-masthead-name">Ashley High School</span>
        </h1>
        <p className="home-masthead-ensembles">
          Concert Bands · Marching Band · Percussion · Jazz · Colorguard · Pep Band
        </p>
        <p className="home-masthead-place">Wilmington, North Carolina</p>
      </section>

      <section className="home-family" aria-labelledby="home-family-title">
        <div className="section-heading home-family-heading">
          <div><p className="eyebrow">For students and families</p><h2 id="home-family-title">Start here.</h2></div>
          <Link className="text-link" href="/calendar">Open the band calendar</Link>
        </div>
        <div className="home-action-grid">
          <article className="home-action home-action-primary">
            <p className="eyebrow">Family records and forms</p>
            <h3>Family Portal</h3>
            <p>Review contacts, student details, forms, and your connected funding and payment records.</p>
            <Link className="button primary" href="/portal">Open Family Portal</Link>
          </article>
          <article className="home-action">
            <p className="eyebrow">Response requested: September 4</p>
            <h3>Carnegie Hall 2027</h3>
            <p>Share your family’s response and deposit choice. Already completed the $50 deposit? Review your record in the portal.</p>
            <Link className="text-link" href="/carnegie-2027/commit">Family commitment</Link>
            <Link className="text-link" href="/info/carnegie-2027">Read the current trip information</Link>
          </article>
          <article className="home-action">
            <p className="eyebrow">Ways to help</p>
            <h3>Current fundraisers</h3>
            <p>Find campaign dates, student-credit instructions, and links to share with friends and family.</p>
            <Link className="text-link" href="/fundraising">See current fundraisers</Link>
            <div className="home-fundraiser-links">
              {data.fundraisers.map((fundraiser) => <Link key={fundraiser.slug} href={`/fundraising/${fundraiser.slug}`}>{fundraiser.title}</Link>)}
            </div>
          </article>
          <article className="home-action">
            <p className="eyebrow">Program news</p>
            <h3>AshleyBands Weekly</h3>
            <p>Student accomplishments, the week ahead, and what families need to know.</p>
            <Link className="text-link" href="/newsletter">Read the latest issue</Link>
          </article>
        </div>
      </section>

      <HomeUpcomingEvents />

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

      <section className="photo-band">
        <div className="photo-band-img-wrap">
          <Image
            src="/656637421_1325880026241163_8640066925134763727_n.jpg"
            alt="Ashley High School Wind Ensemble on stage"
            fill
            style={{ objectFit: "cover", objectPosition: "center 30%" }}
            priority
          />
          <div className="photo-band-overlay">
            <p className="photo-band-label">Ashley High School Wind Ensemble</p>
            <p className="photo-band-sub">Robert A. Parker, Director</p>
          </div>
        </div>
      </section>

      <section className="trophy-strip">
        <div className="trophy-strip-inner">
          <div className="trophy-strip-img-wrap">
            <Image
              src="/567638942_18535699147058878_8482643743523406198_n.jpg"
              alt="Ashley marching band students with trophies"
              fill
              style={{ objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
          <div className="trophy-strip-copy">
            <p className="eyebrow">Screaming Eagle Regiment</p>
            <h2>A program that competes — and wins.</h2>
            <p>Our students invest hundreds of hours each season in rehearsal, performance, and competition. The results show.</p>
          </div>
        </div>
      </section>

      <section className="section home-store">
        <div>
          <p className="eyebrow">Spirit Wear</p>
          <h2>Band Shirts Store</h2>
          <p>
            The official Red Band Shirt is required for all band members and used for pep rallies,
            community performances, parades, and informal events.
          </p>
          <a className="text-link" href={data.quickLinks[3].href}>Open Band Shirts Store</a>
        </div>
      </section>

      <section className="chat-hero">
        <Image
          src="/528048622_10108973219927428_7681318735311321118_n.jpg"
          alt=""
          fill
          style={{ objectFit: "cover", objectPosition: "center 40%" }}
          className="chat-hero-bg"
        />
        <div className="chat-hero-inner">
          <p className="chat-hero-sub">
            Ask anything about the program - dates, attire, trips, marching band, and more.
          </p>
          <form className="chat-hero-form" onSubmit={handleSubmit}>
            <input
              className="chat-hero-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about Ashley Bands..."
              aria-label="Question about Ashley Bands"
              autoComplete="off"
            />
            <button className="chat-hero-btn" type="submit" aria-label="Ask">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </form>
          <div className="chat-hero-prompts">
            {PROMPTS.map((p) => (
              <button key={p} className="prompt-pill" type="button" onClick={() => handlePrompt(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="home-newsletter" aria-labelledby="home-newsletter-title">
        <div className="home-newsletter-copy">
          <p className="eyebrow">Sundays from Ashley Bands</p>
          <h2 id="home-newsletter-title">The week behind us. The week ahead.</h2>
          <p>
            AshleyBands Weekly shares student accomplishments, upcoming dates, and the few things students and families need to do next.
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
