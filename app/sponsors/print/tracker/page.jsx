import PrintControls from "@/components/PrintControls";
import { SPONSOR_LEAD } from "@/lib/sponsorshipContent";

export const metadata = {
  title: "Family Outreach Sheet (Print) | Bands of AHS",
  robots: { index: false }
};

const BLANK_ROWS = [1, 2, 3, 4, 5];

export default function PrintTrackerPage() {
  return (
    <main className="print-page">
      <PrintControls />

      <article className="print-doc">
        <header className="print-letterhead">
          <p className="print-org">The Bands of Ashley High School</p>
          <p className="print-eyebrow">Family Outreach Sheet — 2026-2027</p>
        </header>

        <h1 className="print-h1">My 5-Business Outreach List</h1>

        <table className="print-form-table">
          <tbody>
            <tr><td>Family name</td><td className="print-form-blank" /></tr>
            <tr><td>Student name</td><td className="print-form-blank" /></tr>
            <tr><td>Section</td><td className="print-form-blank" /></tr>
          </tbody>
        </table>

        <h2 className="print-h2">The five businesses</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Business name</th>
              <th>My relationship (1 sentence)</th>
              <th>Contact person</th>
            </tr>
          </thead>
          <tbody>
            {BLANK_ROWS.map((n) => (
              <tr key={`biz-${n}`}>
                <td>{n}</td>
                <td className="print-form-blank" />
                <td className="print-form-blank" />
                <td className="print-form-blank" />
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="print-h2">Outreach tracking</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Dropped off</th>
              <th>Follow-up</th>
              <th>Status</th>
              <th>$ committed</th>
              <th>Sent to {SPONSOR_LEAD.name}?</th>
            </tr>
          </thead>
          <tbody>
            {BLANK_ROWS.map((n) => (
              <tr key={`track-${n}`}>
                <td>{n}</td>
                <td className="print-form-blank" />
                <td className="print-form-blank" />
                <td className="print-form-blank" />
                <td className="print-form-blank" />
                <td>☐</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="print-h2">Status legend</h2>
        <ul className="print-ul-tight">
          <li><strong>Pending</strong> — packet delivered, waiting on decision.</li>
          <li><strong>Yes</strong> — committed. Form sent to {SPONSOR_LEAD.name} at {SPONSOR_LEAD.email}.</li>
          <li><strong>No</strong> — not this year. Mark "ask again later" if they invited a future ask.</li>
          <li><strong>Ask again later</strong> — note the month they suggested.</li>
        </ul>

        <h2 className="print-h2">When you hit a yes</h2>
        <ol className="print-ol-tight">
          <li>Get the signed sponsorship form (paper or online confirmation).</li>
          <li>Email it to <strong>{SPONSOR_LEAD.email}</strong> with subject: <em>Sponsor commit — [Business Name] — [Your Family Name]</em></li>
          <li>{SPONSOR_LEAD.name} takes it from there: thank-you call, recognition setup, intake.</li>
          <li>Update this sheet (Status: Yes, Amount, Sent to {SPONSOR_LEAD.name}: ✓).</li>
        </ol>

        <h2 className="print-h2">When you hit a no</h2>
        <p className="print-small">
          Mark "No" and move on. A no is not a personal rejection. It's a budget cycle, a partner
          not on board, or the wrong year for that business. Saying yes to even 1 out of 5 puts
          a meaningful sponsorship in front of the program. Saying yes to 2 or 3 changes what's
          possible for your student.
        </p>
      </article>
    </main>
  );
}
