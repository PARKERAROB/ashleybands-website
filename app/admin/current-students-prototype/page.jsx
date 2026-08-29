import CurrentStudentsPrototype from "./CurrentStudentsPrototype";

export const metadata = {
  title: "Current Students Prototype | Ashley Bands",
  description: "A synthetic, read-only prototype of the Ashley Bands current-student workspace.",
  robots: { index: false, follow: false }
};

export default function CurrentStudentsPrototypePage() {
  return <CurrentStudentsPrototype />;
}
