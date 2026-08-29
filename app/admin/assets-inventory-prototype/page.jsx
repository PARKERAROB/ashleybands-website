import AssetsInventoryPrototype from "./AssetsInventoryPrototype";

export const metadata = {
  title: "Assets & Inventory Prototype | Ashley Bands",
  description: "A synthetic, read-only prototype of the Ashley Bands asset and inventory workspace.",
  robots: { index: false, follow: false }
};

export default async function AssetsInventoryPrototypePage({ searchParams }) {
  const params = await searchParams;
  return <AssetsInventoryPrototype
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
    initialCategory={typeof params?.category === "string" ? params.category : "all"}
    initialStatus={typeof params?.status === "string" ? params.status : "all"}
    initialAssetId={typeof params?.asset === "string" ? params.asset : ""}
  />;
}
