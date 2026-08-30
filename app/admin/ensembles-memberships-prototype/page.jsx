import EnsemblesMembershipsPrototype from "./EnsemblesMembershipsPrototype";

export const metadata = {
  title: "Ensembles & Memberships Prototype | Ashley Bands",
  description: "A synthetic, read-only prototype connecting program memberships, school class enrollment, and current students.",
  robots: { index: false, follow: false }
};

export default async function EnsemblesMembershipsPrototypePage({ searchParams }) {
  const params = await searchParams;
  return <EnsemblesMembershipsPrototype
    initialView={typeof params?.view === "string" ? params.view : "groups"}
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
    initialDetailId={typeof params?.detail === "string" ? params.detail : ""}
  />;
}
