import PracticeLoopClient from "./PracticeLoopClient";

export const metadata = {
  title: "A Bernstein Tribute Practice Map | Ashley Bands",
  description: "A simple rehearsal-section self-assessment prototype for Ashley Bands students.",
  robots: { index: false, follow: false },
};

export default function BernsteinTributePracticePage() {
  return <PracticeLoopClient pieceSlug="bernstein-tribute" />;
}
