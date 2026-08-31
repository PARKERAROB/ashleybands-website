import CarnegieCommitmentClient from "../../carnegie-2027/commit/CarnegieCommitmentClient";

export const metadata = {
  title: "Carnegie Hall Commitment | Ashley Bands Family Portal",
  description: "Submit and pay the connected Carnegie Hall 2027 conditional deposit.",
  robots: { index: false, follow: false },
};

export default function PortalCarnegieCommitmentPage() {
  return <CarnegieCommitmentClient portalMode />;
}
