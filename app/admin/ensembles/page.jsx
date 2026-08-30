import ProgramMembershipsWorkspace from "./ProgramMembershipsWorkspace";

export const metadata = {
  title: "Ensembles & Memberships | Ashley Bands",
  description: "Protected Ashley Bands program groups and school-class connections.",
  robots: { index: false, follow: false },
};

export default async function ProgramMembershipsPage({ searchParams }) {
  const params = await searchParams;
  return <ProgramMembershipsWorkspace
    initialView={typeof params?.view === "string" ? params.view : "groups"}
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
    initialDetail={typeof params?.detail === "string" ? params.detail : ""}
    initialSearch={typeof params?.q === "string" ? params.q : ""}
    initialEnsembleId={typeof params?.ensemble === "string" ? params.ensemble : (typeof params?.group === "string" ? params.group : "")}
    initialActivityId={typeof params?.activity === "string" ? params.activity : ""}
    initialSectionId={typeof params?.class === "string" ? params.class : ""}
    initialGrade={typeof params?.grade === "string" ? params.grade : ""}
    initialInstrument={typeof params?.instrument === "string" ? params.instrument : ""}
    initialSort={typeof params?.sort === "string" ? params.sort : "name"}
  />;
}
