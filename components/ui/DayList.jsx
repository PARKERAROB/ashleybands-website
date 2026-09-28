import Link from "next/link";
import styles from "./DayList.module.css";

/**
 * Events grouped by day, in date order (#153). Used for "this week" style lists.
 *
 * days     [{ key, label, date?, events: [{ key, title, time, place?, note?, href? }] }]
 *          label is the day heading ("Tomorrow", "Thursday, October 1"). date is optional small text beside it.
 *          Take days and events from the calendar source; never type dates into a page.
 * empty    shown when days is empty. Say so in words and link the full calendar.
 * compact  true lays the days side by side from tablet width up (home page strip).
 * headingLevel level for day headings, 2 to 4 (default 2). Event titles use the next level.
 */
export default function DayList({ days = [], empty, compact = false, headingLevel = 2, className }) {
  const level = Math.min(4, Math.max(2, Number(headingLevel) || 2));
  const DayHeading = `h${level}`;
  const EventHeading = `h${level + 1}`;
  const classes = [styles.days, compact ? styles.compact : null, className].filter(Boolean).join(" ");

  if (!days.length) return empty ? <div className={styles.empty}>{empty}</div> : null;

  return (
    <div className={classes}>
      {days.map((day) => {
        const headingId = `day-${day.key}`;
        return (
          <section key={day.key} className={styles.day} aria-labelledby={headingId}>
            <DayHeading id={headingId} className={styles.dayLabel}>
              {day.label}
              {day.date ? <span className={styles.dayDate}>{day.date}</span> : null}
            </DayHeading>
            <ul className={styles.list}>
              {day.events.map((event) => (
                <li key={event.key} className={styles.event}>
                  <EventHeading className={styles.title}>{event.title}</EventHeading>
                  <p className={styles.meta}>
                    <span>{event.time}</span>
                    {event.place ? <span className={styles.place}>{event.place}</span> : null}
                  </p>
                  {event.note ? <p className={styles.note}>{event.note}</p> : null}
                  {event.href ? (
                    <Link className={styles.details} href={event.href} aria-label={`Details for ${event.title}, ${day.label}`}>
                      Details
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
