import { Suspense } from "react";
import GiveClient from "./GiveClient";

export const metadata = {
  title: "Give to the Bands of Ashley | Bands of AHS",
  description: "Support the Bands of Ashley High School by check or online. Ashley High School Band Boosters, a 501(c)(3)."
};

export default function SponsorGivePage() {
  return (
    <Suspense fallback={<main className="give-shell"><p role="status">Loading giving options…</p></main>}>
      <GiveClient />
    </Suspense>
  );
}
