import { Suspense } from "react";
import Link from "next/link";
import GiveClient from "@/app/sponsors/give/GiveClient";
import CarnegieFunding from "@/components/CarnegieFunding";
import { BOOSTER_NONPROFIT_COPY, CARNEGIE_CAMPAIGN, CARNEGIE_PURPOSE, CARNEGIE_CHANGE_TERMS } from "@/lib/sponsorCampaigns.mjs";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import "./giving.css";

export const metadata = {
  title: "Support Ashley’s Carnegie Trip | Ashley Bands",
  description: "Donate or become a business sponsor for Ashley Bands’ 2027 Carnegie Hall performance trip through the Ashley High School Band Boosters, a 501(c)(3) nonprofit."
};

export default function CarnegieGivingPage() {
  return (
    <main className="carnegie-giving">
      <header className="carnegie-giving-intro">
        <p className="eyebrow">Ashley High School Bands · Wilmington, NC</p>
        <h1>Help Ashley students<br />take the stage.</h1>
        <p className="carnegie-giving-lede">Support Ashley’s Carnegie Hall trip</p>
        <p>Our Concert Band and Wind Ensemble have been selected to perform at Carnegie Hall in March 2027. Your support helps make the trip possible for our students.</p>
        <p className="carnegie-giving-trust"><strong>{BOOSTER_NONPROFIT_COPY}</strong></p>
        <a href="#make-a-gift" className="home-btn home-btn-primary">Make a gift</a>{" "}
        <Link className="carnegie-giving-detail-link" href="/info/carnegie-2027">Read about the trip →</Link>
      </header>
      <CarnegieFunding />
      <div className="carnegie-giving-layout">
        <section id="make-a-gift" aria-label="Make a Carnegie campaign gift">
          <Suspense fallback={<p>Loading giving options…</p>}>
            <GiveClient campaignCode={CARNEGIE_CAMPAIGN} embedded />
          </Suspense>
        </section>
        <section id="about-your-gift" className="carnegie-giving-details">
          <h2>What your gift supports</h2>
          <p>{CARNEGIE_PURPOSE}</p>
          <h2>What 501(c)(3) means</h2>
          <p>The Ashley High School Band Boosters is a federally recognized charitable nonprofit. You give to the boosters, who support Ashley’s band students and administer these campaign gifts.</p>
          <p>Your donation may qualify for a charitable tax deduction. If goods or services are provided in return, their value reduces the deductible portion. Your receipt will identify the contribution and any benefits provided.</p>
          <h2>Donations and business sponsorships</h2>
          <p>Individuals, families, alumni, and businesses can give $5 or more. This campaign checkout includes no merchandise, tickets, or advertising package. Businesses can contact Mr. Parker to discuss recognition or a larger partnership before giving.</p>
          <h2>Receipts and payment options</h2>
          <p>Give online through PayPal’s available payment options, or choose check for mailing instructions. Online receipts go to the email on the PayPal account. Check gifts remain pending until the boosters confirm receipt.</p>
          <h2>If plans change</h2>
          <p>{CARNEGIE_CHANGE_TERMS}</p>
          <p>Travel plans, final participation, price, approvals, and funding remain subject to confirmation.</p>
          <h2>Other ways to help</h2>
          <p><a href={`mailto:${SPONSOR_CONTACT.email}?subject=Ashley%20Carnegie%20trip%20support`}>Discuss a larger gift, employer match, or in-kind support</a></p>
          <p><Link href="/fundraising">Support a current fundraiser</Link> · <Link href="/sponsors">Explore general band sponsorships</Link></p>
        </section>
      </div>
    </main>
  );
}
