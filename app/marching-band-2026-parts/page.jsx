import partsData from "@/content/marching-band-2026-parts.json";
import MarchingBandPartsClient from "./MarchingBandPartsClient";

export const metadata = {
  title: "Ascend 2026 Parts Dashboard | Ashley Bands",
  description: "Compact marching band signup status and Ascend Grade 2-3 part assignment dashboard for Ashley Bands."
};

export default function MarchingBandPartsPage() {
  return <MarchingBandPartsClient partsData={partsData} />;
}
