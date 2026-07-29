import LeadershipBriefClient from "./LeadershipBriefClient";

export const metadata = {
  title: "Leadership Brief | Bands of AHS",
  description:
    "Where the 2026 marching band operating system stands, what is settled, and what is still open.",
  robots: { index: false, follow: false },
};

export default function LeadershipBriefPage() {
  return <LeadershipBriefClient />;
}
