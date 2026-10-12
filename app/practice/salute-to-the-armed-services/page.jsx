import PracticeLoopClient from "../bernstein-tribute/PracticeLoopClient";

export const metadata = {
  title: "Salute to the Armed Services Practice Map | Ashley Bands",
  description: "A rehearsal-section self-assessment for Ashley Bands students.",
  robots: { index: false, follow: false },
};

export default function SaluteToTheArmedServicesPracticePage() {
  return <PracticeLoopClient pieceSlug="salute-to-the-armed-services" />;
}
