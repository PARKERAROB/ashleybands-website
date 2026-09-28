import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import NewsletterPreferenceAction from "@/components/NewsletterPreferenceAction";

export const metadata = { title: "AshleyBands Weekly Preferences" };

export default async function NewsletterUnsubscribePage({ searchParams }) {
  const { token = "" } = await searchParams;
  return (
    <main className="newsletter-action-page">
      <PageHeader eyebrow="AshleyBands Weekly" title="Newsletter preference" />
      <NewsletterPreferenceAction mode="unsubscribe" token={String(token)} />
      <Link href="/newsletter">Return to AshleyBands Weekly</Link>
    </main>
  );
}
