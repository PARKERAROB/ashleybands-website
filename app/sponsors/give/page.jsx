import { Suspense } from "react";
import GiveClient from "./GiveClient";

export const metadata = {
  title: "Give — Sponsor the Bands of Ashley | Bands of AHS",
  description: "Support the Bands of Ashley High School by check or online. AHS Band Boosters, a 501(c)(3)."
};

export default function SponsorGivePage() {
  return (
    <Suspense fallback={null}>
      <GiveClient />
    </Suspense>
  );
}
