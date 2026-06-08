import Voter from "./Voter";
import "../band-of-heroes.css";

export const metadata = {
  title: "Band of Heroes — Vote",
  description: "Vote in the Band of Heroes musical adventure.",
  robots: { index: false, follow: false }
};

export default function BandOfHeroesVotePage() {
  return <Voter />;
}
