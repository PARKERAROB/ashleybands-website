import Link from "next/link";

// Archived-page notice for past events (#133). Uses the existing .archive-notice style.
// `event` names what the page records, e.g. "the August 2026 Open House".
export default function ArchiveBanner({ event, href = "/calendar", linkLabel = "See the band calendar" }) {
  return (
    <aside className="archive-notice archive-banner" aria-label="Archived page">
      <p>
        <strong>Archived.</strong> This page is a record of {event}. Dates and deadlines on it have passed.
      </p>
      <p>
        <Link href={href}>{linkLabel}</Link>
      </p>
    </aside>
  );
}
