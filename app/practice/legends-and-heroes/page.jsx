import PracticeLoopClient from "../bernstein-tribute/PracticeLoopClient";

export const metadata = {
  title: "Legends and Heroes Practice Map | Ashley Bands",
  description: "A movement-by-movement rehearsal-section self-assessment for Ashley Bands students.",
  robots: { index: false, follow: false },
};

export default function LegendsAndHeroesPracticePage() {
  return <PracticeLoopClient pieceSlug="legends-and-heroes" />;
}
