import Link from "next/link";
import { FileText, Printer } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import styles from "./page.module.css";

export const metadata = {
  title: "Carnegie Hall 2027 Media Kit | Ashley Bands",
  description: "Download the Ashley Bands Carnegie Hall 2027 media kit, press release, briefs and handouts in color or black and white."
};

// Files live in public/carnegie/media/. Each piece has a color PDF and a "-bw" print PDF (#164).
const PIECES = [
  { file: "complete-media-kit", title: "Complete Media Kit", purpose: "The full story in nine pages. For reporters writing a feature and for major donors and sponsors." },
  { file: "media-brief", title: "Media Brief", purpose: "A one-page pitch for a newsroom." },
  { file: "press-release", title: "Press Release", purpose: "The announcement, ready for a news outlet to run." },
  { file: "civic-brief", title: "Civic and Government Brief", purpose: "For elected officials and civic leaders." },
  { file: "business-sponsor-brief", title: "Business Sponsor Brief", purpose: "For businesses. The QR code opens the business giving form." },
  { file: "community-donor-brief", title: "Community Donor Brief", purpose: "For individuals and families who want to give." },
  { file: "student-handout", title: "Student Handout", purpose: "One page with a large QR code. Students hand it out to family and friends." },
  { file: "student-pamphlet", title: "Student Pamphlet", purpose: "The main hand-out piece. Print double-sided, flip on the short edge, and fold in thirds." },
  { file: "table-tent", title: "Table Tent", purpose: "For restaurant tables and counters. Print one side on cardstock and fold in half." }
];

export default function CarnegieMediaKitPage() {
  return (
    <main className={`narrow-page ${styles.page}`}>
      <PageHeader
        eyebrow="Carnegie Hall 2027"
        title="Media kit"
        lede="Everything you need to tell the story of Ashley's trip to Carnegie Hall. Each piece comes in color and in black and white for printing."
        actions={<ButtonLink href="/carnegie/media/complete-media-kit.pdf">Download the complete kit</ButtonLink>}
      />

      <ul className={styles.list}>
        {PIECES.map((piece) => (
          <li key={piece.file} className={styles.piece}>
            <div>
              <h2>{piece.title}</h2>
              <p>{piece.purpose}</p>
            </div>
            <div className={styles.links}>
              <ButtonLink href={`/carnegie/media/${piece.file}.pdf`} variant="secondary">
                <FileText size={20} aria-hidden="true" /> Color PDF
              </ButtonLink>
              <ButtonLink href={`/carnegie/media/${piece.file}-bw.pdf`} variant="quiet">
                <Printer size={20} aria-hidden="true" /> Print (B&amp;W)
              </ButtonLink>
            </div>
          </li>
        ))}
      </ul>

      <section className={styles.contact}>
        <h2>Questions or interviews</h2>
        <p>Email Mr. Parker at <a href={`mailto:${SPONSOR_CONTACT.email}?subject=Ashley%20Carnegie%20media`}>{SPONSOR_CONTACT.email}</a>.</p>
        <p>Every QR code and link in the kit goes to <Link href="/support-carnegie">ashleybands.com/support-carnegie</Link>.</p>
      </section>
    </main>
  );
}
