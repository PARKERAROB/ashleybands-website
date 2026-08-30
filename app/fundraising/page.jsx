import Link from "next/link";
import { getFundraisers } from "@/lib/siteData";

export const metadata = {
  title: "Current Fundraisers | Bands of AHS",
  description: "Current Ashley Bands fundraisers, dates, instructions, and official links."
};

export default function FundraisingPage() {
  const fundraisers = getFundraisers();

  return (
    <main className="fundraising-page">
      <header className="fundraising-masthead">
        <p className="eyebrow">Support Ashley Bands</p>
        <h1>Current fundraisers</h1>
        <p className="lede">
          Pick the fundraiser you need. Each page has the current dates, the exact steps, and one
          clear link to share.
        </p>
      </header>

      <section className="fundraiser-card-grid" aria-label="Current Ashley Bands fundraisers">
        {fundraisers.map((fundraiser) => (
          <article className="fundraiser-card" key={fundraiser.slug}>
            <p className="fundraiser-status">{fundraiser.status}</p>
            <h2>{fundraiser.title}</h2>
            <p>{fundraiser.summary}</p>
            <dl>
              <div>
                <dt>When</dt>
                <dd>{fundraiser.timing}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>{fundraiser.location}</dd>
              </div>
            </dl>
            <Link className="fundraiser-card-link" href={`/fundraising/${fundraiser.slug}`}>
              See everything you need
            </Link>
          </article>
        ))}
      </section>

      <section className="fundraising-note">
        <div>
          <p className="eyebrow">A simpler weekly newsletter</p>
          <h2>The newsletter gives the nudge. These pages keep the details.</h2>
        </div>
        <p>
          Save or share the fundraiser page itself. If a detail changes, families will still have
          one current place to check.
        </p>
      </section>

      <section className="fundraising-more">
        <h2>Looking for another way to help?</h2>
        <p>Businesses and families can also support Ashley Bands through a sponsorship.</p>
        <Link className="text-link" href="/sponsors">
          See sponsorship opportunities
        </Link>
      </section>
    </main>
  );
}
