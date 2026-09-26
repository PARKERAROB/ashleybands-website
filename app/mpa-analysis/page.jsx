import MpaAnalysisClient from "./MpaAnalysisClient";
import StaffOnlyNotice from "@/components/StaffOnlyNotice";
import { staffCanReadInternalDocs } from "@/lib/staffPageAccess";

export const metadata = {
  title: "2026 NC MPA Analysis | Ashley Bands",
  description: "Working view of aggregated 2026 NC MPA analysis notes.",
  // Internal working view (#133). robots.txt also disallows it.
  robots: { index: false, follow: false }
};

// Internal document: rendered only for signed-in program staff (#142).
export default async function MpaAnalysisPage() {
  if (!(await staffCanReadInternalDocs())) return <StaffOnlyNotice title="2026 NC MPA analysis" />;
  return <MpaAnalysisClient />;
}
