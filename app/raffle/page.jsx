import { ButtonLink, Notice, PageHeader } from "@/components/ui";
import OfferForm from "./OfferForm";
import styles from "./raffle.module.css";

export const metadata = {
  title: "Holiday Raffle | Bands of AHS",
  description: "Win holiday prizes and help send the Ashley band to Carnegie Hall. Drawing at the Winter Concert on December 8.",
};

// Holiday raffle (#212). Prize gallery and ticket sales arrive in November.
export default function RafflePage() {
  return (
    <main className={`narrow-page ${styles.page}`}>
      <PageHeader
        eyebrow="Carnegie Hall 2027"
        title="Holiday Raffle"
        lede="Win holiday prizes and help send the band to Carnegie Hall."
        actions={<ButtonLink href="#offer">Offer a prize</ButtonLink>}
      />

      <section className={styles.section} aria-labelledby="raffle-when">
        <h2 id="raffle-when">When and how</h2>
        <ul className={styles.facts}>
          <li>The drawing is at the Winter Concert on Tuesday, December 8.</li>
          <li>Tickets go on sale in November. Buy them online here or in person.</li>
          <li>You do not need to be at the drawing to win.</li>
        </ul>
        <p>
          Each ticket pulled wins the next prize on the list. More tickets means more chances to win.
          Ticket prices and the full prize list will be posted here in November.
        </p>
        <p>
          The Ashley High School Band Boosters run the raffle. Money raised goes to the band&apos;s Carnegie Hall trip in 2027.
        </p>
        <Notice title="Raffle tickets are not tax-deductible." />
      </section>

      <section className={styles.section} id="offer" aria-labelledby="raffle-offer">
        <h2 id="raffle-offer">Offer a prize</h2>
        <p>
          Businesses and families can donate a prize or an experience. Every prize goes into one shared list.
          We will contact you to arrange the details. Each donor gets a thank-you letter from the Band Boosters.
        </p>
        <OfferForm />
      </section>
    </main>
  );
}
