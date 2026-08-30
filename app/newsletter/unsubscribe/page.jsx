import Link from "next/link";
import NewsletterPreferenceAction from "@/components/NewsletterPreferenceAction";

export const metadata = { title: "AshleyBands Weekly Preferences" };

export default async function NewsletterUnsubscribePage({ searchParams }) {
  const { token = "" } = await searchParams;
  return (
    <main className="newsletter-action-page">
      <p className="newsletter-kicker">AshleyBands Weekly</p>
      <h1>Newsletter preference</h1>
      <NewsletterPreferenceAction mode="unsubscribe" token={String(token)} />
      <Link href="/newsletter">Return to AshleyBands Weekly</Link>
    </main>
  );
}
