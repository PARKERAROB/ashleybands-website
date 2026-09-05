import MarkdownBlock from "@/components/MarkdownBlock";
import { getSiteData } from "@/lib/siteData";

export const metadata = {
  title: "Band Boosters | Bands of AHS",
  description: "Help Ashley Bands with events, fundraising, hospitality, and student opportunities."
};

export default function BoostersPage() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">Support Ashley Bands</p>
      <h1>Band Boosters</h1>
      <p className="lede">A place for every family to help.</p>
      <MarkdownBlock markdown={getSiteData().boosters} />
    </main>
  );
}
