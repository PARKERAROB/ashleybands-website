import FinancialWorkspace from "./FinancialWorkspace";

export const metadata = {
  title: "Financial | Ashley Bands Staff",
  description: "Private program fee and campaign funding operations.",
  robots: { index: false, follow: false },
};

export default async function FinancialPage({ searchParams }) {
  const params = await searchParams;
  return (
    <FinancialWorkspace
      initialView={params?.view === "campaign" ? "campaign" : "fees"}
      initialStudentId={typeof params?.student === "string" ? params.student : ""}
      initialFilter={typeof params?.filter === "string" ? params.filter : "all"}
    />
  );
}
