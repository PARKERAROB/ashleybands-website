import MarkdownBlock from "@/components/MarkdownBlock";
import { PageHeader } from "@/components/ui";
import { getSiteData } from "@/lib/siteData";

export const metadata = {
  title: "Band Boosters | Bands of AHS",
  description: "Help Ashley Bands with events, fundraising, hospitality, and student opportunities."
};

export default function BoostersPage() {
  return (
    <main className="narrow-page">
      <PageHeader
        eyebrow="Support Ashley Bands"
        title="Band Boosters"
        lede="Every parent and guardian in the program is a member."
      />
      <MarkdownBlock markdown={getSiteData().boosters} />
    </main>
  );
}
