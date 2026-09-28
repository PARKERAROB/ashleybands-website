import Link from "next/link";
import calendarEvents from "@/public/calendar-data.json";
import { DayList, PageHeader } from "@/components/ui";
import { listPublishedNewsletterIssues } from "@/lib/newsletter";
import { longDate, upcomingByDay } from "@/lib/thisWeek.mjs";
import styles from "./page.module.css";

export const metadata = {
  title: "This Week | Bands of AHS",
  description: "Ashley Bands events from today through the weekend, from the official band calendar."
};

// Rechecks hourly so "Today" and the window (7 days, through Sunday) move forward without a deploy (#134).
export const revalidate = 3600;

function issueDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York"
  }).format(new Date(`${date}T12:00:00-04:00`));
}

// Read at render time (hourly, per `revalidate`), in the band's timezone.
function currentWeek() {
  return upcomingByDay(calendarEvents, Date.now(), { days: 7, throughWeekend: true });
}

export default async function ThisWeekPage() {
  const days = currentWeek();
  // The Weekly has no structured to-do field, so link the issue instead of guessing tasks.
  const [latest] = await listPublishedNewsletterIssues(1);

  return (
    <main className={`narrow-page ${styles.page}`}>
      <PageHeader
        eyebrow="For students and families"
        title="This week"
        lede="Band events from today through the weekend, from the official band calendar."
      />

      <DayList
        days={days.map((day) => ({
          key: day.date,
          label: day.label,
          date: day.label === "Today" || day.label === "Tomorrow" ? longDate(day.date) : null,
          events: day.events.map((event) => ({
            key: event.anchor,
            title: event.title,
            time: event.time,
            place: event.location,
            note: event.description,
            href: event.href
          }))
        }))}
        empty={
          <>
            <p className={styles.emptyText}>Nothing on the band calendar through the weekend.</p>
            <Link className="text-link" href="/calendar">See the full band calendar</Link>
          </>
        }
      />

      <section className={styles.todo} aria-labelledby="family-todo">
        <h2 id="family-todo">What families need to do</h2>
        {latest ? (
          <>
            <p>This week&apos;s family notes are in the latest Weekly.</p>
            <Link className="text-link" href={`/newsletter/${latest.slug}`}>
              Read AshleyBands Weekly, {issueDate(latest.issue_date)}
            </Link>
          </>
        ) : (
          <>
            <p>Family notes go out in AshleyBands Weekly.</p>
            <Link className="text-link" href="/newsletter">Read AshleyBands Weekly</Link>
          </>
        )}
      </section>

      <p className={styles.footer}>
        Dates can change. The <Link href="/calendar">band calendar</Link> always has the latest times.
        Subscribe once and changes show up on your phone.
      </p>
    </main>
  );
}
