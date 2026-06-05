import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import RespondConfirm from "./RespondConfirm";

export const metadata = {
  title: "Thank you | Bands of Ashley HS",
  robots: { index: false }
};

async function lookupBusinessName(token) {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("business_outreach")
    .select("id, business:businesses(name_display)")
    .eq("click_token", token)
    .maybeSingle();
  if (!data) return null;
  return data.business?.name_display || "your business";
}

export default async function RespondPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.t;
  const action = (params?.a || "").toLowerCase();
  const status = params?.status;

  // Confirm step: the email link lands here read-only. Nothing changes until the
  // visitor presses the button (which POSTs). This is what keeps mail scanners
  // from auto-answering on a business's behalf.
  if (token && ["yes", "no"].includes(action)) {
    const businessName = await lookupBusinessName(token);
    if (!businessName) {
      return <InvalidLink />;
    }
    return (
      <main className="sponsors-page">
        <section className="sponsors-hero">
          <RespondConfirm token={token} action={action} businessName={businessName} />
        </section>
      </main>
    );
  }

  if (status === "yes") {
    return <YesMessage />;
  }
  if (status === "no") {
    return <NoMessage />;
  }
  return <InvalidLink />;
}

function YesMessage() {
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

function NoMessage() {
  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <h1>Got it. No worries.</h1>
        <p className="sponsors-lede">
          We've removed your business from our outreach list. Thanks for the moment of your time.
        </p>
        <p>
          If you change your mind down the road, the director is at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
        </p>
      </section>
    </main>
  );
}

function InvalidLink() {
  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <h1>Hmm, that link didn't work.</h1>
        <p className="sponsors-lede">
          The response link may have expired or been used already. If you have a question or want
          to talk about sponsorship, email the director at{" "}
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>.
        </p>
      </section>
    </main>
  );
}
