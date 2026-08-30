import CurrentStudentsWorkspace from "./CurrentStudentsWorkspace";

export const metadata = {
  title: "Current Students | Ashley Bands",
  description: "Protected Ashley Bands current-student operations workspace.",
  robots: { index: false, follow: false },
};

export default async function CurrentStudentsPage({ searchParams }) {
  const params = await searchParams;
  return <CurrentStudentsWorkspace initialStudentId={typeof params?.student === "string" ? params.student : ""} />;
}
