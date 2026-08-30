import AttendanceWorkspace from "./AttendanceWorkspace";

export const metadata = {
  title: "Attendance | Ashley Bands Staff",
  description: "Private program-event and school-day attendance operations.",
  robots: { index: false, follow: false }
};

export default async function AttendancePage({ searchParams }) {
  const params = await searchParams;
  return (
    <AttendanceWorkspace
      initialSource={params?.source === "school" ? "school" : "program"}
      initialView={typeof params?.view === "string" ? params.view : ""}
      initialStudentId={typeof params?.student === "string" ? params.student : ""}
      initialOccurrenceKey={typeof params?.occurrence === "string" ? params.occurrence : ""}
    />
  );
}
