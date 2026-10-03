import AscendCheckClient from "./AscendCheckClient";

export const metadata = {
  title: "Ascend Self Check | Ashley Bands",
  description: "Marching students rate each Ascend cleaning zone and send it to the staff.",
  robots: { index: false, follow: false },
};

export default function AscendCheckPage() {
  return <AscendCheckClient />;
}
