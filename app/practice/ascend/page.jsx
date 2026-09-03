import PracticeLoopClient from "../bernstein-tribute/PracticeLoopClient";

export const metadata = {
  title: "Ascend Practice Map | Ashley Bands",
  description: "A rehearsal-mark self-assessment for the Ashley Bands marching production.",
  robots: { index: false, follow: false },
};

export default function AscendPracticePage() {
  return <PracticeLoopClient pieceSlug="ascend" />;
}
