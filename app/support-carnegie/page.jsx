import { Suspense } from "react";
import Link from "next/link";
import GiveClient from "@/app/sponsors/give/GiveClient";
import CarnegieFunding from "@/components/CarnegieFunding";
import { CARNEGIE_CAMPAIGN, CARNEGIE_PURPOSE } from "@/lib/sponsorCampaigns.mjs";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import "./giving.css";

export const metadata = {
  title: "Support Ashley’s Carnegie Trip | Ashley Bands",
  description: "Donate or become a business sponsor for Ashley Bands’ 2027 Carnegie Hall performance trip through the Ashley High School Band Boosters, a 501(c)(3) nonprofit."
};

export default function CarnegieGivingPage() {
  return (
    <main className="carnegie-giving">
      <PageHeader
        className="carnegie-giving-intro"
        eyebrow="Ashley High School Bands · Wilmington, NC"
        title={<>Help Ashley students<br />take the stage.</>}
        lede="Six years after COVID nearly ended the program, both Ashley concert bands will play Carnegie Hall on March 25, 2027."
        actions={
          <>
            <ButtonLink href="#make-a-gift">Make a gift</ButtonLink>
            <ButtonLink href="/our-story" variant="quiet">Read our story <span aria-hidden="true">→</span></ButtonLink>
          </>
        }
      >
        <p>Your gift goes to the group trip. It lowers the cost for every student who goes.</p>
      </PageHeader>
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
          <h2>Who receives your gift</h2>
          <p>The Ashley High School Band Boosters, a federally recognized charitable nonprofit. The boosters support Ashley’s band students and administer these campaign gifts.</p>
          <p>Your donation may qualify for a charitable tax deduction. If goods or services are provided in return, their value reduces the deductible portion. Your receipt will identify the contribution and any benefits provided.</p>
          <h2>Businesses</h2>
          <p>Individuals, families, alumni, and businesses can give $5 or more. This campaign checkout includes no merchandise, tickets, or advertising package.</p>
          <h2>Receipts and payment options</h2>
          <p>Give online through PayPal’s available payment options, or choose check for mailing instructions. Online receipts go to the email on the PayPal account. Check gifts remain pending until the boosters confirm receipt.</p>
          <p>Travel plans, final participation, price, approvals, and funding remain subject to confirmation.</p>
          <h2>Other ways to help</h2>
          <p><a href={`mailto:${SPONSOR_CONTACT.email}?subject=Ashley%20Carnegie%20trip%20support`}>Discuss a larger gift, employer match, or in-kind support</a></p>
          <p><Link href="/fundraising">Support a current fundraiser</Link> · <Link href="/sponsors">Explore general band sponsorships</Link></p>
        </section>
      </div>
    </main>
  );
}
