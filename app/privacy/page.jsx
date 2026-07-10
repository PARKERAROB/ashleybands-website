// Privacy Notice — approved by Mr. Parker 2026-07-10 (word-by-word, v4).
// Source of record: BandsofAHS/projects/placement-authority-2026-27/privacy-notice-DRAFT.md
// Any wording change goes back through Mr. Parker.

export const metadata = {
  title: "Privacy Notice | Bands of AHS",
  description: "What information ashleybands.com collects, how it is used, and the choices available to families."
};

export default function PrivacyNoticePage() {
  return (
    <main className="narrow-page">
      <h1>Privacy Notice</h1>
      <p className="lede">Effective date: July 10, 2026 · ashleybands.com</p>

      <p>
        This site supports the Ashley High School band program. This notice describes the
        information the site collects, how it is used, and the choices available to families.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Program records</strong>: rosters, instrument, uniform, and locker assignments,
          music checkouts, and schedules.
        </li>
        <li>
          <strong>Contact information</strong> provided by your family through the portal, such as
          names, email addresses, and phone numbers.
        </li>
        <li>
          <strong>Payment records</strong>: fees charged, payments received, and sponsorships.
          Payments are processed by PayPal; this site does not store card or bank account numbers.
        </li>
      </ul>
      <p>This site does not collect grades, coursework, or academic records.</p>

      <h2>How information is used and shared</h2>
      <p>
        Information is used only to operate the band program. It is not sold, shared with third
        parties for marketing, or used for advertising.
      </p>
      <p>
        Access is limited by role. Families can view and manage their own information. The
        director can view program records. The booster treasurer can view payment records. Booster
        board officers, such as the president, vice president, and fundraising and chaperone
        coordinators, can access the information their role requires, including sending program
        communications and coordinating events, fundraising, and volunteers. Access to family
        information is logged.
      </p>

      <h2>Your choices</h2>
      <p>
        You can review and update your information at any time in the portal. To request deletion
        of your information, contact Mr. Parker; requests are honored promptly.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this notice: <a href="mailto:robert.parker@nhcs.net">robert.parker@nhcs.net</a>.
      </p>
    </main>
  );
}
