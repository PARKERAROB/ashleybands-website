import BoosterMeetingDeck from "./BoosterMeetingDeck";
import "./meeting-deck.css";

export const metadata = {
  title: "September 1 Booster Meeting | Ashley Bands",
  description: "Ashley Bands September 1 Booster Meeting presentation.",
  robots: { index: false, follow: false }
};

export default function SeptemberBoosterMeetingPage() {
  return <BoosterMeetingDeck />;
}

