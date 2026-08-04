import Link from "next/link";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";

export const metadata = {
  title: "Family Campaign Tools | Bands of AHS Sponsors",
  description:
    "Run your student's sponsorship outreach: online tracker, printable materials, and a 90-second pitch guide."
};

export default function CampaignPage() {
  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <p className="eyebrow">For students and families</p>
        <h1>Family Campaign Tools</h1>
        <p className="sponsors-lede">
          Everything you need to run sponsorship outreach for your student. Pick 5 local
          businesses you already know, choose whether to contact them yourself or have the band
          make the introduction, and keep the follow-up organized in your Family Portal.
        </p>
        <div className="sponsors-cta-row">
          <Link href="/portal/sponsorship" className="sponsors-btn sponsors-btn-primary">
            Open family sponsorship
          </Link>
          <Link href="/sponsors" className="sponsors-btn">
            ← Back to sponsor info
          </Link>
        </div>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">The pitch in 90 seconds</p>
        <h2>How sponsorship outreach actually works</h2>
        <ol className="campaign-steps">
          <li>
            <strong>Build your warm list (15 min).</strong> List 5 local businesses your family
            already has a real relationship with: dentist, mechanic, restaurant, parent's
            employer, neighbor with a small business. Skip big-box stores and strangers.
          </li>
          <li>
            <strong>Visit in person if you can.</strong> Lead with the relationship ("I've been
            coming here for 8 years"), make the ask, hand them the leave-behind 1-pager, set a
            follow-up week, thank them. 90 seconds, not a sales pitch.
          </li>
          <li>
            <strong>Follow up.</strong> Most yeses come on the second contact. Don't take a no
            personally — it's usually a budget cycle, not a rejection.
          </li>
          <li>
            <strong>Send commits to Mr. Parker.</strong> Family makes the introduction. Mr.
            Parker thanks the sponsor, delivers any recognition, and the booster team handles
            intake and receipts. You don't have to be a salesperson.
          </li>
        </ol>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">Tools</p>
        <h2>Online tracker</h2>
        <p>
          Add businesses your family knows, ask the band to make the first introduction when
          that helps, browse businesses that are already open to hearing from an Ashley family,
          and mark each business after you make contact. Everything lives in the Family Portal.
        </p>
        <div className="sponsors-cta-row">
          <Link href="/portal/sponsorship" className="sponsors-btn sponsors-btn-primary">
            Open family sponsorship
          </Link>
        </div>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">Print materials</p>
        <h2>Printables you can take into a business</h2>
        <div className="campaign-printables">
          <article className="campaign-printable">
            <h3>Leave-behind 1-pager</h3>
            <p>
              The single page you hand to the business after a visit. Tier summary, Adopt-an-
              Instrument overview, tax info, contact. Print one per business.
            </p>
            <Link href="/sponsors/print/leave-behind" className="sponsors-btn sponsors-btn-primary">
              Print leave-behind
            </Link>
          </article>
          <article className="campaign-printable">
            <h3>Full packet</h3>
            <p>
              The formal version. Cover letter, full tier matrix, Adopt-an-Instrument menu, and
              sponsorship form. Use this when a business wants the complete picture or asks for
              something to share internally.
            </p>
            <Link href="/sponsors/print/packet" className="sponsors-btn">
              Print full packet
            </Link>
          </article>
          <article className="campaign-printable">
            <h3>Paper outreach sheet</h3>
            <p>
              Prefer to track on paper? Print this blank sheet for your 5 businesses + outreach
              log. (The online tracker does the same thing with auto-save and dedup against other
              families.)
            </p>
            <Link href="/sponsors/print/tracker" className="sponsors-btn">
              Print outreach sheet
            </Link>
          </article>
        </div>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">Closing the loop</p>
        <h2>When a business says yes</h2>
        <ol className="campaign-steps">
          <li>Get the signed sponsorship form (paper from the packet, or online submission).</li>
          <li>
            Email it to <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a> with
            subject: <em>Sponsor commit — [Business Name] — [Your Student Name]</em>
          </li>
          <li>Mark “I contacted them” in your Family Sponsorship dashboard.</li>
          <li>
            Mr. Parker takes it from there: thank-you call, recognition setup, intake, tax
            receipt within two weeks.
          </li>
        </ol>
      </section>

      <section className="sponsors-section sponsors-contact">
        <p className="eyebrow">Questions</p>
        <h2>Stuck or need help?</h2>
        <p>
          Email Mr. Parker directly at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>. He'd rather
          you ask once than guess.
        </p>
      </section>

      <footer className="sponsors-footer">
        <p>
          <Link href="/sponsors">← Sponsor info page</Link>
        </p>
      </footer>
    </main>
  );
}
