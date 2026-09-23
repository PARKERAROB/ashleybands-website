"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import HomeUpcomingEvents from "@/components/HomeUpcomingEvents";
import NewsletterSignup from "@/components/NewsletterSignup";
import CarnegieFunding from "@/components/CarnegieFunding";
import MattressSaleBanner from "@/components/MattressSaleBanner";
import { BOOSTER_NONPROFIT_COPY, CARNEGIE_GIVING_PATH, CARNEGIE_SUGGESTED_AMOUNTS } from "@/lib/sponsorCampaigns.mjs";
import { getSiteData } from "@/lib/siteData";

const PROMPTS = [
  "Where can I find upcoming band dates?",
  "What do students need for band?",
  "How do I subscribe to the calendar?",
  "How does the Carnegie conditional deposit work?"
];

const COMEBACK = [
  ["2020", "COVID nearly ended the program. About 52 students were left, rehearsing outside in masks. Mr. Parker said rebuilding would take seven years."],
  ["The rebuild", "Class after class learned the program, stayed, and taught the next group. Most of them graduated before the invitation came."],
  ["Now", "Superior ratings at MPA. The second highest enrollment in twenty years. This is the seventh season, and both concert bands are going to Carnegie Hall."]
];

// Add approved student quotes here once the student media volunteer has permission to publish them.
// Each entry: { quote, name, detail, photo?, photoAlt? }. The section stays hidden while empty.
const STUDENT_VOICES = [];

const GIVE_KINDS = [
  { key: "personal", label: "Personal", amounts: CARNEGIE_SUGGESTED_AMOUNTS.donation },
  { key: "business", label: "Business", amounts: CARNEGIE_SUGGESTED_AMOUNTS.sponsorship }
];

const INFO_GROUPS = [
  { category: "Current information", eyebrow: "What is happening now" },
  { category: "Everyday resources", eyebrow: "What students need" }
];

export default function HomePage() {
  const data = getSiteData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [giveKind, setGiveKind] = useState("personal");
  const [giveAmount, setGiveAmount] = useState(null);
  const giveHref = `${CARNEGIE_GIVING_PATH}?kind=${giveKind}${typeof giveAmount === "number" ? `&amount=${giveAmount}` : ""}#make-a-gift`;

  const bandShirtsStore = data.quickLinks.find((link) => link.label === "Band Shirts Store");
  const groups = INFO_GROUPS.map((group) => ({
    ...group,
    pages: data.pages.filter((page) => page.category === group.category)
  }));

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
      <MattressSaleBanner />

      <section className="home-campaign-hero" aria-labelledby="home-hero-title">
        <div className="home-campaign-copy">
          <p className="home-campaign-kicker">Ashley High School Bands · North Carolina</p>
          <h1 id="home-hero-title">From Wilmington<br />to <em>Carnegie Hall.</em></h1>
          <p className="home-campaign-lede">
            Six years ago, Ashley Bands was down to about 52 students, rehearsing outside in masks. In March, both
            concert bands play Carnegie Hall.
          </p>
          <p className="home-campaign-date">New York City <span aria-hidden="true">/</span> March 25, 2027</p>
          <div className="home-campaign-actions">
            <Link className="home-btn home-btn-primary" href={CARNEGIE_GIVING_PATH}>Help get them there <span aria-hidden="true">→</span></Link>
            <Link className="home-campaign-story-link" href="/our-story">Read our story <span aria-hidden="true">→</span></Link>
          </div>
          <p className="home-giving-trust"><strong>{BOOSTER_NONPROFIT_COPY}</strong></p>
        </div>
        <figure className="home-campaign-art">
          <Image src="/images/home/perlman-stage.avif" alt="View from the Perlman Stage at Carnegie Hall, with a grand piano and the auditorium beyond" fill sizes="(max-width: 900px) 100vw, 48vw" priority style={{ objectFit: "cover" }} />
          <div className="home-campaign-art-title" aria-hidden="true"><span>New York City</span><strong>Carnegie<br />2027</strong></div>
          <figcaption>Carnegie Hall · View from the Perlman Stage</figcaption>
        </figure>
      </section>

      <CarnegieFunding />

      <section className="home-comeback" aria-labelledby="home-comeback-title">
        <div className="home-container home-comeback-grid">
          <div>
            <p className="eyebrow">Our story</p>
            <h2 id="home-comeback-title">The comeback.</h2>
            <ol className="home-comeback-beats">
              {COMEBACK.map(([label, text]) => <li key={label}><strong>{label}</strong><p>{text}</p></li>)}
            </ol>
            <Link className="home-comeback-link" href="/our-story">Read the full story, 2006 to now <span aria-hidden="true">→</span></Link>
          </div>
          <figure className="home-comeback-photo">
            <Image src="/656637421_1325880026241163_8640066925134763727_n.jpg" alt="Ashley High School Wind Ensemble performing on stage" fill sizes="(max-width: 900px) 100vw, 45vw" style={{ objectFit: "cover", objectPosition: "center 40%" }} />
            <figcaption>Ashley Wind Ensemble · 2026</figcaption>
          </figure>
        </div>
        {STUDENT_VOICES.length > 0 && (
          <div className="home-container home-voices">
            {STUDENT_VOICES.map((voice) => (
              <figure className="home-voice" key={voice.name}>
                {voice.photo && <Image src={voice.photo} alt={voice.photoAlt || ""} width={96} height={96} />}
                <blockquote>{voice.quote}</blockquote>
                <figcaption>{voice.name}{voice.detail ? `, ${voice.detail}` : ""}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="home-give" id="give" aria-labelledby="home-give-title">
        <div className="home-container home-give-grid">
          <div>
            <p className="eyebrow">How to help</p>
            <h2 id="home-give-title">Help get the band<br />to New York.</h2>
            <p>Gifts go to the group trip, not to one student&apos;s account. Every dollar lowers the cost for everyone.</p>
          </div>
          <div className="home-give-panel">
            <div className="home-give-kinds" role="group" aria-label="Type of gift">
              {GIVE_KINDS.map((kind) => (
                <button key={kind.key} type="button" aria-pressed={giveKind === kind.key} onClick={() => { setGiveKind(kind.key); setGiveAmount(null); }}>{kind.label}</button>
              ))}
            </div>
            <div className="home-give-amounts" role="group" aria-label="Suggested gift amounts">
              {GIVE_KINDS.find((kind) => kind.key === giveKind).amounts.map((dollars) => (
                <button key={dollars} type="button" aria-pressed={giveAmount === dollars} onClick={() => setGiveAmount(dollars)}>${dollars.toLocaleString("en-US")}</button>
              ))}
              <button type="button" aria-pressed={giveAmount === "other"} onClick={() => setGiveAmount("other")}>Other</button>
            </div>
            <Link className="home-btn home-btn-primary home-give-go" href={giveHref}>
              {typeof giveAmount === "number" ? `Give $${giveAmount.toLocaleString("en-US")}` : "Continue to give"} <span aria-hidden="true">→</span>
            </Link>
            <p className="home-giving-trust">{BOOSTER_NONPROFIT_COPY}</p>
            <div className="home-links"><Link href="/fundraising">Current fundraisers</Link><a href="mailto:robert.parker@nhcs.net?subject=Ashley%20Carnegie%20trip%20support">Larger gift or employer match</a></div>
            <p className="home-campaign-planning">Travel plans, final participation, price, approvals, and funding remain subject to confirmation.</p>
          </div>
        </div>
      </section>

      <nav className="home-family-bar" aria-label="Student and family shortcuts">
        <span>Already part of the band?</span>
        <Link href="/portal">Family Portal <span aria-hidden="true">↗</span></Link>
        <Link href="/calendar">Band Calendar <span aria-hidden="true">↗</span></Link>
        <Link href="/info/carnegie-2027">Carnegie family information <span aria-hidden="true">↗</span></Link>
      </nav>



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

      <section className="home-program-story" id="about-the-program" aria-labelledby="our-story-title">
        <div className="home-container home-program-grid">
          <figure className="home-program-photo">
            <Image src="/656637421_1325880026241163_8640066925134763727_n.jpg" alt="Ashley High School Wind Ensemble performing on stage" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover", objectPosition: "center 40%" }} />
            <figcaption>Ashley Wind Ensemble · 2026</figcaption>
          </figure>
          <div className="home-program-copy" id="program-of-distinction">
            <Image className="home-program-badge" src="/images/home/program-of-distinction.png" alt="Official NCBA Program of Distinction badge, 2025–2026" width={112} height={112} />
            <p className="eyebrow">About the program</p>
            <h2 id="our-story-title">Built in the band room.<br />Ready for a bigger stage.</h2>
            <p>Ashley students play in two concert bands, the marching band, percussion, jazz band, colorguard, and pep band. Mr. Parker took the job in 2006, fresh out of college, and has directed the program ever since.</p>
            <p>In March 2026 the Wind Ensemble earned a Superior rating at Grade VI and the Concert Band earned a Superior at Grade IV. Ten students were selected for the Eastern District All-District Band. The North Carolina Bandmasters Association also named Ashley to its first class of Programs of Distinction.</p>
            <p>The program fell to about 52 students after COVID. Enrollment this year is the second highest of Mr. Parker’s time at Ashley, and the Carnegie Hall invitation came out of that rebuild. Mr. Parker played there once himself, as a freshman with the Mount Tabor High School band.</p>
            <div className="home-links"><Link href="/our-story">The full story, 2006 to now</Link><Link href="/programs">Concert programs</Link><Link href="/info/marching-band-2026">The Screaming Eagle Regiment</Link></div>
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
            <p className="eyebrow">For band families</p>
            <h2 id="home-support-title">Boosters and spirit wear.</h2>
          </div>
          <div className="home-support-grid">
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
