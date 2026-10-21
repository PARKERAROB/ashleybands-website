import { Suspense } from "react";
import { MoneyLine, Notice, PageHeader } from "@/components/ui";
import { MEAL_PAYEE, MEAL_PRICE_CENTS, SIGNUP_DEADLINE_LABEL, formatCents, offeredMeals, signupsOpen } from "@/lib/allCountyMeals.mjs";
import MealOrderForm from "./MealOrderForm";
import styles from "./meals.module.css";

export const metadata = {
  title: "All-County Meal Orders | Ashley Bands",
  description: "Band directors order pizza meals for their students at the NHCS All-County Honor Band clinic.",
  robots: { index: false, follow: false },
};

// Rendered per request so the deadline takes effect without a deploy.
export const dynamic = "force-dynamic";

// Director-facing order page (#221). Shared by direct link only; not in the sitemap.
export default function AllCountyMealsPage() {
  const open = signupsOpen();
  const closedMessage = `Orders closed ${SIGNUP_DEADLINE_LABEL}. Please email Mr. Parker at robert.parker@nhcs.net.`;
  return (
    <main className={`narrow-page ${styles.page}`}>
      <PageHeader
        eyebrow="NHCS All-County Honor Band"
        title="All-County Meal Orders"
        lede="Band directors: order boxed meals for your students at the clinic. The Ashley Band Boosters order to your exact numbers."
      />

      <section className={styles.section} aria-labelledby="meals-what">
        <h2 id="meals-what">What you can order</h2>
        <p>Each meal is pizza, chips and a drink, boxed for one student. Meals are served at the Minnie Evans Arts Center.</p>
        <ul className={styles.facts}>
          {offeredMeals().map((meal) => <li key={meal.key}>{meal.detail}</li>)}
        </ul>
        <p>Students may bring their own food instead. Only list students who want a meal.</p>
        <MoneyLine
          purpose="All-County meal"
          amount={`${formatCents(MEAL_PRICE_CENTS)} per meal`}
          receiver={MEAL_PAYEE}
          receipt="Collect from your students ahead of time. Give the Band Boosters one check or cash payment for your school. No paying at the table."
        />
        <Notice tone="deadline" title={`Orders and changes close ${SIGNUP_DEADLINE_LABEL}.`}>
          <p>You get an invoice on screen and by email. Its private link lets you add or remove students until then.</p>
        </Notice>
      </section>

      <section className={styles.section} aria-labelledby="meals-order">
        <h2 id="meals-order">Your order</h2>
        <Suspense fallback={<p role="status">Loading the order form…</p>}>
          <MealOrderForm open={open} closedMessage={closedMessage} />
        </Suspense>
      </section>

      <p className={styles.help}>Questions? Email Mr. Parker at robert.parker@nhcs.net.</p>
    </main>
  );
}
