import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import NewsletterSignup from "@/components/NewsletterSignup";
import { getPublishedNewsletterIssue } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

function displayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(new Date(`${date}T12:00:00-04:00`));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const issue = await getPublishedNewsletterIssue(slug);
  return issue
    ? { title: `${issue.title} | AshleyBands Weekly`, description: issue.preview_text }
    : { title: "AshleyBands Weekly" };
}

export default async function NewsletterIssuePage({ params }) {
  const { slug } = await params;
  const issue = await getPublishedNewsletterIssue(slug);
  if (!issue) notFound();

  return (
    <main className="newsletter-issue-page">
      <article className="newsletter-issue">
        <header className="newsletter-issue-header">
          <Link href="/newsletter">AshleyBands Weekly</Link>
          <p>{displayDate(issue.issue_date)}</p>
          <h1>{issue.title}</h1>
          <p className="newsletter-issue-preview">{issue.preview_text}</p>
        </header>
        <div className="newsletter-issue-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.public_markdown}</ReactMarkdown>
        </div>
        <footer className="newsletter-issue-footer">
          <p>For the complete current schedule, use the <Link href="/calendar">Ashley Bands calendar</Link>.</p>
        </footer>
      </article>

      <section className="newsletter-issue-subscribe" aria-labelledby="issue-subscribe-title">
        <div>
          <p className="newsletter-kicker">AshleyBands Weekly</p>
          <h2 id="issue-subscribe-title">Receive the next public issue.</h2>
        </div>
        <NewsletterSignup compact />
      </section>
    </main>
  );
}

