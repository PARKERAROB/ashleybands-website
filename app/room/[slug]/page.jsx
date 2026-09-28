import { notFound } from "next/navigation";
import board from "@/content/sources/classroom-board.json";
import RoomBoard from "./RoomBoard";

// Band room board (#154). Unlisted: wrong slug is a 404, noindex meta here plus
// X-Robots-Tag in next.config.js, no links, not in sitemap.xml or robots.txt.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Band Room",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
};

export default async function RoomPage({ params }) {
  const { slug } = await params;
  if (slug !== board.slug) notFound();
  const { slug: _omit, _readme: _note, ...data } = board;
  return <RoomBoard slug={slug} initialData={data} />;
}
