import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import NewsletterPreferenceAction from "@/components/NewsletterPreferenceAction";

export const metadata = { title: "Confirm AshleyBands Weekly" };

export default async function NewsletterConfirmPage({ searchParams }) {
  const { token = "" } = await searchParams;
  return (
    <main className="newsletter-action-page">
      <PageHeader eyebrow="AshleyBands Weekly" title="Confirm your subscription" />
      <NewsletterPreferenceAction mode="confirm" token={String(token)} />
      <Link href="/newsletter">Return to AshleyBands Weekly</Link>
    </main>
  );
}
