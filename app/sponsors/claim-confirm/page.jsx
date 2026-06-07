import { Suspense } from "react";
import ClaimConfirmClient from "./ClaimConfirmClient";

export const metadata = {
  title: "Confirm — Ashley Bands Sponsorship",
  robots: { index: false }
};

export default function ClaimConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ClaimConfirmClient />
    </Suspense>
  );
}
