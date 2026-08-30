import Link from "next/link";
import NewsletterSignup from "@/components/NewsletterSignup";
import { listPublishedNewsletterIssues } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AshleyBands Weekly | Bands of AHS",
  description: "Weekly Ashley Bands news, student accomplishments, upcoming events, and program links."
};

function displayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(new Date(`${date}T12:00:00-04:00`));
}

export default async function NewsletterPage() {
  const issues = await listPublishedNewsletterIssues();
  const [latest, ...archive] = issues;

  return (
    <main className="newsletter-page">
      <section className="newsletter-masthead">
        <p className="newsletter-kicker">Sundays from Ashley Bands</p>
        <h1>AshleyBands Weekly</h1>
        <p>
          What our students accomplished, what is happening this week, and what students and families need to know.
        </p>
      </section>

      <section className="newsletter-layout">
        <div className="newsletter-main-column">
          {latest ? (
            <article className="newsletter-latest-card">
              <p className="newsletter-date">{displayDate(latest.issue_date)}</p>
              <h2>{latest.title}</h2>
              <p>{latest.preview_text}</p>
              <Link className="newsletter-primary-link" href={`/newsletter/${latest.slug}`}>
                Read this week&apos;s issue
              </Link>
            </article>
          ) : (
            <article className="newsletter-latest-card newsletter-empty-card">
              <p className="newsletter-date">The first issue</p>
              <h2>Coming this Sunday</h2>
              <p>The first AshleyBands Weekly issue is being prepared and reviewed.</p>
            </article>
          )}

          {archive.length > 0 && (
            <section className="newsletter-archive" aria-labelledby="newsletter-archive-title">
              <h2 id="newsletter-archive-title">Past issues</h2>
              <div className="newsletter-archive-list">
                {archive.map((issue) => (
                  <Link key={issue.slug} href={`/newsletter/${issue.slug}`}>
                    <span>{displayDate(issue.issue_date)}</span>
                    <strong>{issue.title}</strong>
                    <small>{issue.preview_text}</small>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="newsletter-sidebar" aria-labelledby="newsletter-subscribe-title">
          <p className="newsletter-kicker">Parents, alumni, and friends</p>
          <h2 id="newsletter-subscribe-title">Get the public edition.</h2>
          <p>
            Current students and families receive the member edition. Anyone else may subscribe to the public edition here.
          </p>
          <NewsletterSignup />
          <div className="newsletter-sidebar-links">
            <Link href="/calendar">Band Calendar</Link>
            <Link href="/portal">Family Portal</Link>
            <Link href="/sponsors">Support Ashley Bands</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
