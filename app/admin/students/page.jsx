import CurrentStudentsWorkspace from "./CurrentStudentsWorkspace";

export const metadata = {
  title: "Current Students | Ashley Bands",
  description: "Protected Ashley Bands current-student operations workspace.",
  robots: { index: false, follow: false },
};

export default async function CurrentStudentsPage({ searchParams }) {
  const params = await searchParams;
  return <CurrentStudentsWorkspace
    initialView={params?.view === "inactive" ? "inactive" : "active"}
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
    initialSearch={typeof params?.q === "string" ? params.q : ""}
    initialGrade={typeof params?.grade === "string" ? params.grade : "All"}
    initialEnsemble={typeof params?.ensemble === "string" ? params.ensemble : "All"}
    initialInstrument={typeof params?.instrument === "string" ? params.instrument : "All"}
    initialNeed={typeof params?.need === "string" ? params.need : "All"}
    initialSort={typeof params?.sort === "string" ? params.sort : "last-asc"}
  />;
}
