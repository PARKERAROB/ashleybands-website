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
  const sponsorshipPages = [
    { slug: "sponsors", href: "/sponsors", audience: "Businesses and community", title: "Sponsorship opportunities", summary: "Program support, sponsorship levels, and instrument giving." },
    { slug: "give", href: "/sponsors/give", audience: "Families, alumni, and friends", title: "Make a donation", summary: "Give $5 or more to support Ashley Bands. Individuals and businesses are welcome." }
  ];

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
      <nav className="home-family-bar" aria-label="Student and family shortcuts">
        <span>Already part of the band?</span>
        <Link href="/portal">Family Portal <span aria-hidden="true">↗</span></Link>
        <Link href="/calendar">Band Calendar <span aria-hidden="true">↗</span></Link>
        <Link href="/carnegie-2027/commit">Carnegie family response <span aria-hidden="true">↗</span></Link>
      </nav>
      <section className="home-campaign-hero" aria-labelledby="home-hero-title">
        <div className="home-campaign-copy">
          <p className="home-campaign-kicker">Ashley High School Bands · North Carolina</p>
          <h1 id="home-hero-title">From Wilmington<br />to <em>Carnegie Hall.</em></h1>
          <p className="home-campaign-lede">
            Both the Concert Band and the Wind Ensemble have been selected for the National Band &amp; Orchestra
            Festival at Carnegie Hall. Twenty years of Ashley students built the program that earned the invitation.
          </p>
          <p className="home-campaign-date">New York City <span aria-hidden="true">/</span> March 25, 2027</p>
          <div className="home-campaign-actions">
            <Link className="home-btn home-btn-primary" href="/info/carnegie-2027">About the Carnegie Hall trip <span aria-hidden="true">↗</span></Link>
            <Link className="home-campaign-story-link" href="/our-story">How we got here <span aria-hidden="true">→</span></Link>
          </div>
          <a className="home-recognition" href="#program-of-distinction">
            <Image src="/images/home/program-of-distinction.png" alt="Official NCBA Program of Distinction badge, 2025–2026" width={144} height={144} priority />
            <span><span className="home-recognition-label">Recognized statewide</span><strong>Program of Distinction</strong><span>Inaugural class · 2025–2026<br />North Carolina Bandmasters Association</span></span>
          </a>
        </div>
        <figure className="home-campaign-art">
          <Image src="/images/home/perlman-stage.avif" alt="View from the Perlman Stage at Carnegie Hall, with a grand piano and the auditorium beyond" fill sizes="(max-width: 900px) 100vw, 48vw" priority style={{ objectFit: "cover" }} />
          <div className="home-campaign-art-title" aria-hidden="true"><span>New York City</span><strong>Carnegie<br />2027</strong></div>
          <figcaption>Carnegie Hall · View from the Perlman Stage</figcaption>
        </figure>
      </section>

      <section className="home-program-story" id="our-story" aria-labelledby="our-story-title">
        <div className="home-container home-program-grid">
          <figure className="home-program-photo">
            <Image src="/656637421_1325880026241163_8640066925134763727_n.jpg" alt="Ashley High School Wind Ensemble performing on stage" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover", objectPosition: "center 40%" }} />
            <figcaption>Ashley Wind Ensemble · 2026</figcaption>
          </figure>
          <div className="home-program-copy" id="program-of-distinction">
            <p className="eyebrow">About the program</p>
            <h2 id="our-story-title">Built in the band room.<br />Ready for a bigger stage.</h2>
            <p>Ashley students play in two concert bands, the marching band, percussion, jazz band, colorguard, and pep band. Mr. Parker took the job in 2006, fresh out of college, and has directed the program ever since.</p>
            <p>In March 2026 the Wind Ensemble earned a Superior rating at Grade VI and the Concert Band earned a Superior at Grade IV. Ten students were selected for the Eastern District All-District Band. The North Carolina Bandmasters Association also named Ashley to its first class of Programs of Distinction.</p>
            <p>The program fell to about 52 students after COVID. Enrollment this year is the second highest of Mr. Parker’s time at Ashley, and the Carnegie Hall invitation came out of that rebuild. Mr. Parker played there once himself, as a freshman with the Mount Tabor High School band.</p>
            <div className="home-links"><Link href="/our-story">The full story, 2006 to now</Link><Link href="/programs">Concert programs</Link><Link href="/info/marching-band-2026">The Screaming Eagle Regiment</Link></div>
          </div>
        </div>
      </section>

      <section className="home-campaign-future" aria-labelledby="home-campaign-future-title">
        <div className="home-container home-campaign-future-grid">
          <div><p className="eyebrow">Getting the band to New York</p><h2 id="home-campaign-future-title">Help get the band<br />to New York.</h2></div>
          <div><p>The fundraisers below are the easiest place to start. Businesses and anyone considering a larger gift can contact Mr. Parker directly.</p>
            <p className="home-campaign-coming">How to help</p>
            <div className="home-links"><Link href="/fundraising">Current fundraisers</Link><a href="mailto:robert.parker@nhcs.net">Email Mr. Parker</a></div>
            <Link className="home-btn home-btn-secondary" href="/info/carnegie-2027">Current trip information <span aria-hidden="true">↗</span></Link>
            <p className="home-campaign-planning">Travel plans, final participation, price, approvals, and funding remain subject to confirmation.</p>
          </div>
        </div>
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
                <p className="home-now-tag">For participating families</p>
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
            <p className="eyebrow">Marching band</p>
            <h2 id="home-story-title">The Screaming Eagle Regiment.</h2>
            <p>
              The Regiment rehearses Tuesdays and Thursdays from 4:00 to 7:00 PM, plus Saturdays on
              non-competition weeks. Football games, competitions, and parades fill the rest of the fall.
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
              <Link className="home-support-card" href={page.href} key={page.slug}>
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
          <p className="eyebrow">The newsletter</p>
          <h2 id="home-newsletter-title">One email every Sunday.</h2>
          <p>
            AshleyBands Weekly covers what students did, what is coming up, and anything families need to do
            before the next week starts.
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
