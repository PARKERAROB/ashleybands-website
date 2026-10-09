import BusClient from "./BusClient";

export const metadata = {
  title: "Bus Check | Ashley Bands",
  description: "Private Ashley Bands chaperone bus check.",
  robots: { index: false, follow: false }
};

export default async function BusCheckPage({ searchParams }) {
  const params = await searchParams;
  const text = (name) => (typeof params?.[name] === "string" ? params[name] : "");
  return <BusClient
    initialOccurrenceKey={text("occurrence")}
    initialLeg={text("leg") || "to_venue"}
    requestedBuses={text("buses")}
  />;
}
