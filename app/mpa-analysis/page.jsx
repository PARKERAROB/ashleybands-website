import MpaAnalysisClient from "./MpaAnalysisClient";

export const metadata = {
  title: "2026 NC MPA Analysis | Ashley Bands",
  description: "Working view of aggregated 2026 NC MPA analysis notes.",
  // Internal working view (#133). robots.txt also disallows it.
  robots: { index: false, follow: false }
};

export default function MpaAnalysisPage() {
  return <MpaAnalysisClient />;
}
