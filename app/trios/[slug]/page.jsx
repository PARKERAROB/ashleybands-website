import { notFound } from "next/navigation";
import { TRIOS_SLUG } from "@/lib/holidayTrios.mjs";
import TrioPicker from "./TrioPicker";

// Holiday trio picker (#255). Unlisted and temporary: wrong slug is a 404, noindex meta here plus
// X-Robots-Tag in next.config.js, no links, not in sitemap.xml or robots.txt.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Holiday Trios",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
};

export default async function TriosPage({ params }) {
  const { slug } = await params;
  if (slug !== TRIOS_SLUG) notFound();
  return <TrioPicker slug={slug} />;
}
