import LeadershipBriefClient from "./LeadershipBriefClient";

export const metadata = {
  title: "Regiment OS: where we are | Bands of AHS",
  description:
    "Leadership review copy. Every decision made so far, the two hierarchies, the rehearsal day block by block, and the full library of terms.",
  robots: { index: false, follow: false },
};

export default function LeadershipBriefPage() {
  return <LeadershipBriefClient />;
}
