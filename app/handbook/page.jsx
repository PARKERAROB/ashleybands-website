import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Notice from "@/components/ui/Notice";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = {
  title: "Band Handbook | Bands of AHS",
  description: "Ashley High School Band Program Handbook"
};

export default function HandbookPage() {
  return (
    <main className="narrow-page">
      <PageHeader
        eyebrow="Students & Families"
        title="Band Handbook"
        lede="Program expectations, policies, and information for Ashley band members."
      />
      <Notice tone="info" title="This is the 2023-24 handbook.">
        <p>Its policies still apply. Its dates, schedules and funding amounts do not.</p>
        <p>
          For current dates, use the <Link href="/calendar">Band Calendar</Link>. For this fall&apos;s
          marching band, see <Link href="/info/marching-band-2026">Marching Band 2026</Link>.
        </p>
      </Notice>
      <div className="handbook-pdf">
        <ButtonLink href="/handbook.pdf" variant="secondary" target="_blank" rel="noopener noreferrer">
          Download PDF
        </ButtonLink>
        <iframe src="/handbook.pdf" width="100%" height="900" className="handbook-frame" title="Band Handbook" />
      </div>
    </main>
  );
}
