import PortalReviewClient from "./PortalReviewClient";
import { carnegieLettersMode } from "@/lib/carnegieLetters.mjs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Family Portal | Ashley Bands",
  description: "Review student information, band participation, uniforms, and payments."
};

export default function PortalReviewPage() {
  // Link the Carnegie notes page only after the family release (#106).
  return <PortalReviewClient carnegieNotesOpen={carnegieLettersMode() === "on"} />;
}
