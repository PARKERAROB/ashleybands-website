import CalendarView from "./CalendarView";

export const metadata = {
  title: "Band Calendar | Bands of AHS",
  description: "The official Ashley High School band calendar. Subscribe once and dates update automatically."
};

export default function CalendarPage() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">Official Dates</p>
      <h1>Band Calendar</h1>
      <p className="lede">
        This is the source of truth for every band event. Subscribe once and new dates and time
        changes show up on your phone automatically. No need to check back.
      </p>

      <div className="cal-subscribe">
        <a className="button primary" href="webcal://ashleybands.com/calendar.ics">
          Subscribe to the calendar
        </a>
        <a className="button secondary" href="/calendar.ics">
          Download (.ics)
        </a>
      </div>
      <p className="cal-subscribe-note">
        Subscribing works in Apple Calendar, Google Calendar, and Outlook. On Android, open the
        download link in Google Calendar.
      </p>

      <CalendarView />
    </main>
  );
}
