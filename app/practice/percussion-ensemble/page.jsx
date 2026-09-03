import PracticeLoopClient from "../bernstein-tribute/PracticeLoopClient";

export const metadata = {
  title: "Percussion Ensemble Practice Map | Ashley Bands",
  description: "A two-selection rehearsal-range self-assessment for Ashley Bands percussion students.",
  robots: { index: false, follow: false },
};

export default function PercussionEnsemblePracticePage() {
  return <PracticeLoopClient pieceSlug="percussion-ensemble" />;
}
