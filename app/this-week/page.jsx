import Link from "next/link";
import calendarEvents from "@/public/calendar-data.json";
import { listPublishedNewsletterIssues } from "@/lib/newsletter";
import { longDate, upcomingByDay } from "@/lib/thisWeek.mjs";
import styles from "./page.module.css";

export const metadata = {
  title: "This Week | Bands of AHS",
  description: "Ashley Bands events for the next 7 days, from the official band calendar."
};

// Rechecks hourly so "Today" and the 7-day window move forward without a deploy (#134).
export const revalidate = 3600;

function issueDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York"
  }).format(new Date(`${date}T12:00:00-04:00`));
}

// Read at render time (hourly, per `revalidate`), in the band's timezone.
function currentWeek() {
  return upcomingByDay(calendarEvents, Date.now(), { days: 7 });
}

export default async function ThisWeekPage() {
  const days = currentWeek();
  // The Weekly has no structured to-do field, so link the issue instead of guessing tasks.
  const [latest] = await listPublishedNewsletterIssues(1);

  return (
    <main className={`narrow-page ${styles.page}`}>
      <p className="eyebrow">For students and families</p>
      <h1>This week</h1>
      <p className="lede">Band events for the next 7 days, from the official band calendar.</p>

      {days.length === 0 ? (
        <section className={styles.empty} aria-label="This week">
          <p>Nothing on the band calendar in the next 7 days.</p>
          <Link className="text-link" href="/calendar">See the full band calendar</Link>
        </section>
      ) : (
        <div className={styles.days}>
          {days.map((day) => (
            <section key={day.date} className={styles.day} aria-labelledby={`day-${day.date}`}>
              <h2 id={`day-${day.date}`} className={styles.dayLabel}>
                {day.label}
                {day.label === "Today" || day.label === "Tomorrow" ? (
                  <span className={styles.dayDate}>{longDate(day.date)}</span>
                ) : null}
              </h2>
              <ul className={styles.list}>
                {day.events.map((event) => (
                  <li key={event.anchor} className={styles.event}>
                    <h3 className={styles.title}>{event.title}</h3>
                    <p className={styles.meta}>
                      <span>{event.time}</span>
                      {event.location ? <span>{event.location}</span> : null}
                    </p>
                    {event.description ? <p className={styles.description}>{event.description}</p> : null}
                    <Link className={styles.details} href={event.href} aria-label={`Details for ${event.title}, ${day.label}`}>
                      Details
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

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
