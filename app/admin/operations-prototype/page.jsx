import OperationsPrototype from "./OperationsPrototype";

export const metadata = {
  title: "Staff Command Center Prototype | Ashley Bands",
  description: "A synthetic, read-only prototype of the connected Ashley Bands staff workspace.",
  robots: { index: false, follow: false }
};

export default async function OperationsPrototypePage({ searchParams }) {
  const params = await searchParams;
  return <OperationsPrototype
    initialArea={typeof params?.area === "string" ? params.area : "home"}
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
    initialFilter={typeof params?.filter === "string" ? params.filter : ""}
  />;
}
