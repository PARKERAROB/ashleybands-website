import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { signSponsorStudentGiveToken } from "@/lib/sponsorGiveToken.mjs";
import { resolveSponsorStudentCode } from "@/lib/sponsorStudentLinks";
import { CARNEGIE_CAMPAIGN, CARNEGIE_GIVING_PATH } from "@/lib/sponsorCampaigns.mjs";
import { carnegieLettersAccess, confirmedNotesCents } from "@/lib/carnegieLettersServer";
import { EMPLOYER_MATCH_LINE, NOTES_GOAL_CENTS, carnegieLinkPreview } from "@/lib/carnegieLetters.mjs";
import GiveClient from "@/app/sponsors/give/GiveClient";
import NotesChart from "@/components/NotesChart";
import CarnegieBandProgress from "@/components/CarnegieBandProgress";
import "@/app/support-carnegie/giving.css";
import styles from "./landing.module.css";

export const dynamic = "force-dynamic";

const PREVIEW_IMAGE = "/api/carnegie-notes/og";

// Link preview (#106), only while the letter campaign gate is open for this request. First name
// only, no amounts. With the gate off this adds nothing and the route behaves exactly as #103.
export async function generateMetadata({ params }) {
  const access = await carnegieLettersAccess({ cookies: await cookies() });
  if (!access.open) return {};
  const { code } = await params;
  const resolved = await resolveSponsorStudentCode(code);
  if (!resolved) return {};
  const preview = carnegieLinkPreview(resolved.student.public_name);
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
      images: [{ url: PREVIEW_IMAGE, width: 1200, height: 630, alt: preview.imageAlt }]
    },
    twitter: { card: "summary_large_image", title: preview.title, description: preview.description, images: [PREVIEW_IMAGE] }
  };
}

// Carnegie student link (#103). Same signed student token as /support/[code], landing on the
// Carnegie giving page so the gift is recorded as carnegie-2027 with the student's credit.
// Record-keeping only: nothing a student can use as money, and no effect on marching figures.
// With the #106 gate open, it shows the student's music notes and the band's progress first.
export default async function CarnegieStudentSupportLinkPage({ params }) {
  const { code } = await params;
  const resolved = await resolveSponsorStudentCode(code);
  if (!resolved) notFound();

  const token = signSponsorStudentGiveToken({
    linkId: resolved.link.id,
    studentId: resolved.student.id
  });
  const access = await carnegieLettersAccess({ cookies: await cookies() });
  if (!access.open) redirect(`${CARNEGIE_GIVING_PATH}?a=${encodeURIComponent(token)}#make-a-gift`);

  const name = resolved.student.public_name;
  const notesCents = (await confirmedNotesCents([resolved.student.id])).get(resolved.student.id) || 0;
  const dollars = (cents) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
  return (
    <main className={styles.landing}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Bands of AHS · Carnegie Hall 2027</p>
        <p className={styles.invite}>{name} invited you to help fill their music notes</p>
        <h1 className={styles.heading}>Help get them to Carnegie Hall</h1>
        {access.mode === "staff" ? <p className={styles.preview}>Staff preview. The public still sees the current page.</p> : null}
      </header>
      <div className={styles.body}>
        <section className={styles.card} aria-label={`${name}'s music notes`}>
          <div className={styles.row}><strong>{name}&apos;s music notes</strong><span>{dollars(notesCents)} of {dollars(NOTES_GOAL_CENTS)}</span></div>
          <NotesChart className={styles.chart} confirmedCents={notesCents} />
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
