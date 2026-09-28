import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownBlock from "@/components/MarkdownBlock";
import PageHeader from "@/components/ui/PageHeader";
import Notice from "@/components/ui/Notice";
import { getPageBySlug, getSiteData } from "@/lib/siteData";

export function generateStaticParams() {
  return getSiteData().pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  return {
    title: page ? `${page.title} | Bands of AHS` : "Bands of AHS",
    ...(page?.archived ? { robots: { index: false, follow: true } } : {})
  };
}

export default async function InfoPage({ params }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) notFound();

  return (
    <main className={`narrow-page${page.archived ? " archived-page" : ""}`}>
      <PageHeader eyebrow={page.audience} title={page.title} lede={page.summary} />
      {page.archived && (
        <Notice tone="archived" title="Archived information">
          <p>This page preserves historical information from spring 2026. Its dates, costs, payment instructions, and calls to action do not apply to current activities.</p>
          <p><Link href="/info/carnegie-2027">Current Carnegie trip information</Link> · <Link href="/fundraising">Current fundraisers</Link> · <Link href="/calendar">Band calendar</Link></p>
        </Notice>
      )}
      <MarkdownBlock markdown={page.body.replace(/^#{1,2} [^\n]+\n+/, "")} />
    </main>
  );
}
