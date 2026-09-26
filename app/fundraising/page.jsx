import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { getCurrentFundraisers } from "@/lib/siteData";

export const metadata = {
  title: "Current Fundraisers | Bands of AHS",
  description: "Current Ashley Bands fundraisers, dates, instructions, and official links."
};

// Rechecks hourly so a fundraiser with an endsAt date leaves this list soon after it ends (#123).
export const revalidate = 3600;

export default function FundraisingPage() {
  const fundraisers = getCurrentFundraisers();

  return (
    <main className="fundraising-page">
      <PageHeader
        className="fundraising-masthead"
        eyebrow="Support Ashley Bands"
        title="Current fundraisers"
        lede="Pick the fundraiser you need. Each page has the current dates, the exact steps, and one clear link to share."
      />

      {fundraisers.length === 0 ? (
        <section className="fundraising-more" aria-label="Current Ashley Bands fundraisers">
          <h2>No fundraiser is running right now.</h2>
          <p>
            You can still <Link href="/support-carnegie">give to the Carnegie trip</Link> or{" "}
            <Link href="/sponsors">sponsor the band</Link>.
          </p>
        </section>
      ) : (
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
      )}

      <section className="fundraising-note">
        <div>
          <p className="eyebrow">Newsletter and fundraiser pages</p>
          <h2>Each fundraiser has one page, and the newsletter points to it.</h2>
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
