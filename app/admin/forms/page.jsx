import FormsWorkspace from "./FormsWorkspace";

export const metadata = {
  title: "Forms | Ashley Bands Staff",
  description: "Private current form requirements and completion status.",
  robots: { index: false, follow: false },
};

export default async function FormsPage({ searchParams }) {
  const params = await searchParams;
  return <FormsWorkspace initialStudentId={typeof params?.student === "string" ? params.student : ""} initialView={typeof params?.view === "string" ? params.view : "needs"} />;
}
