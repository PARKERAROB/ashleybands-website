import BandReadyPortalClient from "../BandReadyPortalClient";

const allowedSteps = new Set(["calendar", "day-one", "forms", "how-band-works", "clothing", "boosters", "review"]);

export const metadata = {
  title: "Band Ready | Ashley Bands",
  description: "Complete the Ashley Bands Open House checklist for your student."
};

export default async function BandReadyPage({ params }) {
  const resolved = await params;
  const requestedStep = resolved?.step?.[0] || "home";
  const step = allowedSteps.has(requestedStep) ? requestedStep : "home";
  return <BandReadyPortalClient step={step} />;
}
