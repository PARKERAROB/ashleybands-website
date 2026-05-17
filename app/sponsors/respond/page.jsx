import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";

export const metadata = {
  title: "Thank you | Bands of Ashley HS",
  robots: { index: false }
};

export default async function RespondPage({ searchParams }) {
  const params = await searchParams;
  const status = params?.status;

  if (status === "yes") {
    return (
      <main className="sponsors-page">
        <section className="sponsors-hero">
          <h1>Thank you.</h1>
          <p className="sponsors-lede">
            We've noted your business is open to hearing more. An Ashley band family will be in
            touch in the coming weeks with the details.
          </p>
          <p>
            If you'd like to reach out before then, the director is at{" "}
            <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
          </p>
        </section>
      </main>
    );
  }

  if (status === "no") {
    return (
      <main className="sponsors-page">
        <section className="sponsors-hero">
          <h1>Got it. No worries.</h1>
          <p className="sponsors-lede">
            We've removed your business from our outreach list. Thanks for the moment of your
            time.
          </p>
          <p>
            If you change your mind down the road, the director is at{" "}
            <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
          </p>
        </section>
      </main>
    );
  }

  // invalid or missing
  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <h1>Hmm — that link didn't work.</h1>
        <p className="sponsors-lede">
          The response link may have expired or been used already. If you have a question or want
          to talk about sponsorship, email the director at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
        </p>
      </section>
    </main>
  );
}
