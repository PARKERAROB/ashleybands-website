import LeadershipBriefClient from "./LeadershipBriefClient";
import StaffOnlyNotice from "@/components/StaffOnlyNotice";
import { staffCanReadInternalDocs } from "@/lib/staffPageAccess";

export const metadata = {
  title: "Regiment OS: where we are | Bands of AHS",
  description:
    "Leadership review copy. Every decision made so far, the two hierarchies, the rehearsal day block by block, and the full library of terms.",
  robots: { index: false, follow: false },
};

// Internal document: rendered only for signed-in program staff (#142).
export default async function LeadershipBriefPage() {
  if (!(await staffCanReadInternalDocs())) return <StaffOnlyNotice title="Regiment OS leadership brief" />;
  return <LeadershipBriefClient />;
}
