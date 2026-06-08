import Presenter from "./Presenter";
import "./band-of-heroes.css";

export const metadata = {
  title: "Band of Heroes — Live",
  description: "Interactive musical adventure by Erika Svanoe.",
  robots: { index: false, follow: false }
};

export default function BandOfHeroesPage() {
  return <Presenter />;
}
