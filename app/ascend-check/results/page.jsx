import ResultsClient from "./ResultsClient";

export const metadata = {
  title: "Ascend Self Check Results | Ashley Bands",
  description: "Counts of how students rated each Ascend cleaning zone.",
  robots: { index: false, follow: false },
};

export default function AscendResultsPage() {
  return <ResultsClient />;
}
