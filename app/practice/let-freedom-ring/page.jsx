import PracticeLoopClient from "../bernstein-tribute/PracticeLoopClient";

export const metadata = {
  title: "Let Freedom Ring! Practice Map | Ashley Bands",
  description: "A rehearsal-section self-assessment for Ashley Bands students.",
  robots: { index: false, follow: false },
};

export default function LetFreedomRingPracticePage() {
  return <PracticeLoopClient pieceSlug="let-freedom-ring" />;
}
