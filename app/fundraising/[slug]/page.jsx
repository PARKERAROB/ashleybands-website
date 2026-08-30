import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownBlock from "@/components/MarkdownBlock";
import { getFundraiserBySlug, getFundraisers } from "@/lib/siteData";

export function generateStaticParams() {
  return getFundraisers().map((fundraiser) => ({ slug: fundraiser.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const fundraiser = getFundraiserBySlug(slug);
  return {
    title: fundraiser ? `${fundraiser.title} | Bands of AHS` : "Bands of AHS",
    description: fundraiser?.summary
  };
}

export default async function FundraiserPage({ params }) {
  const { slug } = await params;
  const fundraiser = getFundraiserBySlug(slug);
  if (!fundraiser) notFound();

  return (
    <main className="fundraiser-detail-page">
      <header className="fundraiser-detail-hero">
        <div>
          <Link className="fundraiser-back-link" href="/fundraising">
            All current fundraisers
          </Link>
          <p className="fundraiser-status">{fundraiser.status}</p>
          <h1>{fundraiser.title}</h1>
          <p className="fundraiser-summary">{fundraiser.summary}</p>
        </div>
        <dl className="fundraiser-facts">
          <div>
            <dt>When</dt>
            <dd>{fundraiser.timing}</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{fundraiser.location}</dd>
          </div>
          <div>
            <dt>Start here</dt>
            <dd>
              <a href={fundraiser.externalHref}>{fundraiser.externalLabel}</a>
            </dd>
          </div>
        </dl>
      </header>

      <div className="fundraiser-detail-body">
        <MarkdownBlock markdown={fundraiser.body} />

        {fundraiser.flyers?.length ? (
          <section className="fundraiser-flyers" aria-labelledby="fundraiser-flyers-title">
            <p className="eyebrow">Save or share</p>
            <h2 id="fundraiser-flyers-title">Fundraiser flyers</h2>
            <div className="fundraiser-flyer-grid">
              {fundraiser.flyers.map((flyer) => (
                <a href={flyer.src} className="fundraiser-flyer" key={flyer.src}>
                  <Image src={flyer.src} alt={flyer.alt} width={1545} height={1999} />
                  <span>{flyer.label}</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
