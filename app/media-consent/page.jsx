import { Suspense } from "react";
import MediaConsentClient from "./MediaConsentClient";

export const metadata = {
  title: "Media permission | Ashley Bands",
  description: "Record your answer about student interviews.",
  robots: { index: false, follow: false },
};

export default function MediaConsentPage() {
  return (
    <Suspense fallback={null}>
      <MediaConsentClient />
    </Suspense>
  );
}
