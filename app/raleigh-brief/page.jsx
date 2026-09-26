import RaleighBriefClient from "./RaleighBriefClient";

export const metadata = {
  title: "Student Brief — NC General Assembly | Bands of AHS",
  description: "NHCS Legislative Agenda student prep guide for the May 20, 2026 Raleigh trip.",
  // Archived internal brief (#133). robots.txt also disallows it.
  robots: { index: false, follow: false },
};

export default function RaleighBriefPage() {
  return <RaleighBriefClient />;
}
