import { notFound } from "next/navigation";
import MarkdownBlock from "@/components/MarkdownBlock";
import { getPageBySlug, getSiteData } from "@/lib/siteData";

export function generateStaticParams() {
  return getSiteData().pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  return {
    title: page ? `${page.title} | Bands of AHS` : "Bands of AHS"
  };
}

export default async function InfoPage({ params }) {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) notFound();

  return (
    <main className="narrow-page">
      <p className="eyebrow">{page.audience}</p>
      <h1>{page.title}</h1>
      <p className="lede">{page.summary}</p>
      <MarkdownBlock markdown={page.body} />
    </main>
  );
}
