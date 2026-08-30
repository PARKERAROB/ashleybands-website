import AttendanceClient from "./AttendanceClient";

export const metadata = {
  title: "Program Attendance | Ashley Bands",
  description: "Private Ashley Bands program-event attendance roster.",
  robots: { index: false, follow: false }
};

export default async function AttendancePage({ searchParams }) {
  const params = await searchParams;
  return <AttendanceClient
    initialOccurrenceKey={typeof params?.occurrence === "string" ? params.occurrence : ""}
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
  />;
}
