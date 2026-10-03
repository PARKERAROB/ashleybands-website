import StaffRoomClient from "./StaffRoomClient";

// Unlisted staff page (#172, Rob 2026-10-03): no login, never linked from public or student pages.
export const metadata = {
  title: "Ascend Staff Room | Ashley Bands",
  description: "Staff flags and student self checks for Ascend.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AscendStaffRoomPage() {
  return <StaffRoomClient />;
}
