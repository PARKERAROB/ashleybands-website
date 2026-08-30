import Link from "next/link";
import NewsletterPreferenceAction from "@/components/NewsletterPreferenceAction";

export const metadata = { title: "Confirm AshleyBands Weekly" };

export default async function NewsletterConfirmPage({ searchParams }) {
  const { token = "" } = await searchParams;
  return (
    <main className="newsletter-action-page">
      <p className="newsletter-kicker">AshleyBands Weekly</p>
      <h1>Confirm your subscription</h1>
      <NewsletterPreferenceAction mode="confirm" token={String(token)} />
      <Link href="/newsletter">Return to AshleyBands Weekly</Link>
    </main>
  );
}
