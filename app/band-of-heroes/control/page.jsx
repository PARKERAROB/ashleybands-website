import Controller from "./Controller";
import "../band-of-heroes.css";

export const metadata = {
  title: "Band of Heroes — Control",
  description: "Private show controller.",
  robots: { index: false, follow: false }
};

export default function BandOfHeroesControlPage() {
  return <Controller />;
}
