import AssetsWorkspace from "./AssetsWorkspace";

export const metadata = {
  title: "Assets | Ashley Bands Staff",
  description: "Private Ashley Bands asset and current-assignment workspace.",
  robots: { index: false, follow: false }
};

export default async function AssetsPage({ searchParams }) {
  const params = await searchParams;
  return (
    <AssetsWorkspace
      initialStudentId={typeof params?.student === "string" ? params.student : ""}
      initialCategory={typeof params?.category === "string" ? params.category : "all"}
      initialStatus={typeof params?.status === "string" ? params.status : "all"}
      initialAssetId={typeof params?.asset === "string" ? params.asset : ""}
      initialQuery={typeof params?.q === "string" ? params.q : ""}
      initialType={typeof params?.type === "string" ? params.type : "all"}
      initialSort={typeof params?.sort === "string" ? params.sort : "name"}
    />
  );
}
