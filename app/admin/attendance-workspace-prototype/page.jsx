import AttendanceWorkspacePrototype from "./AttendanceWorkspacePrototype";

export const metadata = {
  title: "Attendance Workspace Prototype | Ashley Bands",
  description: "A synthetic, read-only prototype connecting program events with imported Infinite Campus attendance registers.",
  robots: { index: false, follow: false }
};

export default async function AttendanceWorkspacePrototypePage({ searchParams }) {
  const params = await searchParams;
  return <AttendanceWorkspacePrototype
    initialSource={typeof params?.source === "string" ? params.source : "program"}
    initialView={typeof params?.view === "string" ? params.view : ""}
    initialStudentId={typeof params?.student === "string" ? params.student : ""}
    initialSessionId={typeof params?.session === "string" ? params.session : ""}
  />;
}
