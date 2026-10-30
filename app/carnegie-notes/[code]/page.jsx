import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { signSupporterGiveToken } from "@/lib/sponsorGiveToken.mjs";
import { CARNEGIE_CAMPAIGN, CARNEGIE_GIVING_PATH } from "@/lib/sponsorCampaigns.mjs";
import { CARNEGIE_PREVIEW_IMAGE, EMPLOYER_MATCH_LINE, NOTES_GOAL_CENTS, NOTES_NET_LINE, carnegieSupporterPreview, notesDollars, supporterFirstName } from "@/lib/carnegieLetters.mjs";
import { confirmedSupporterCents, resolveCarnegieSupporterCode } from "@/lib/carnegieSupporterLinks";
import GiveClient from "@/app/sponsors/give/GiveClient";
import NotesChart from "@/components/NotesChart";
import CarnegieBandProgress from "@/components/CarnegieBandProgress";
import "@/app/support-carnegie/giving.css";
import styles from "@/app/support/[code]/carnegie/landing.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { code } = await params;
  const supporter = await resolveCarnegieSupporterCode(code);
  if (!supporter) return {};
  const preview = carnegieSupporterPreview(supporter.display_name);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://ashleybands.com"),
    title: `${preview.title} | Ashley Bands`,
    description: preview.description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: preview.siteName,
      title: preview.title,
      description: preview.description,
      images: [{ url: CARNEGIE_PREVIEW_IMAGE, width: 1200, height: 630, alt: preview.imageAlt }]
    },
    twitter: { card: "summary_large_image", title: preview.title, description: preview.description, images: [CARNEGIE_PREVIEW_IMAGE] }
  };
}

// A trusted adult's whole-trip Music Notes (#247). Gifts count on this chart and for the whole
// trip. They never credit a student.
export default async function CarnegieSupporterNotesPage({ params }) {
  const { code } = await params;
  const supporter = await resolveCarnegieSupporterCode(code);
  if (!supporter) notFound();

  const token = signSupporterGiveToken({ supporterLinkId: supporter.id });
  const name = supporterFirstName(supporter.display_name);
  const notesCents = await confirmedSupporterCents(supporter.id);
  const dollars = (cents) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  return (
    <main className={styles.landing}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Bands of AHS · Carnegie Hall 2027</p>
        <p className={styles.invite}>{name} invited you to help fill these music notes</p>
        <h1 className={styles.heading}>Help Ashley students get to Carnegie Hall</h1>
      </header>
      <div className={styles.body}>
        <section className={styles.card} aria-label={`${name}'s music notes`}>
          <div className={styles.row}><strong>{name}&apos;s music notes</strong><span>{notesDollars(notesCents)} of {dollars(NOTES_GOAL_CENTS)}</span></div>
          <NotesChart className={styles.chart} confirmedCents={notesCents} />
          <p className={styles.netNote}>Every gift goes to the whole trip and lowers the cost for every student who goes. {NOTES_NET_LINE}</p>
          <CarnegieBandProgress />
        </section>
        <section id="make-a-gift" className={styles.give} aria-label="Make a Carnegie campaign gift">
          <Suspense fallback={<p>Loading giving options…</p>}>
            <GiveClient campaignCode={CARNEGIE_CAMPAIGN} embedded attributionToken={token} />
          </Suspense>
        </section>
        <p className={styles.match}>{EMPLOYER_MATCH_LINE}</p>
        <p className={styles.more}><Link href={CARNEGIE_GIVING_PATH}>About the Carnegie campaign, receipts and gift terms →</Link></p>
      </div>
    </main>
  );
}
