import RaleighBriefClient from "./RaleighBriefClient";
import StaffOnlyNotice from "@/components/StaffOnlyNotice";
import { staffCanReadInternalDocs } from "@/lib/staffPageAccess";

export const metadata = {
  title: "Student Brief — NC General Assembly | Bands of AHS",
  description: "NHCS Legislative Agenda student prep guide for the May 20, 2026 Raleigh trip.",
  // Archived internal brief (#133). robots.txt also disallows it.
  robots: { index: false, follow: false },
};

// Internal document: rendered only for signed-in program staff (#142).
export default async function RaleighBriefPage() {
  if (!(await staffCanReadInternalDocs())) return <StaffOnlyNotice title="Student brief, NC General Assembly" />;
  return <RaleighBriefClient />;
}
