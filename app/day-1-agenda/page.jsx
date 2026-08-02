import Day1AgendaClient from "./Day1AgendaClient";

export const metadata = {
  title: "Day 1 Working Agenda | Ashley Bands",
  description: "Private conductor view for the Band Camp Day 1 baseline meeting.",
  robots: { index: false, follow: false }
};

export default function Day1AgendaPage() {
  return <Day1AgendaClient />;
}
