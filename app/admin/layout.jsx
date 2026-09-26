import StaffWorkspaceHeader from "@/components/StaffWorkspaceHeader";

// Shared header across all /admin/* pages (#131): workspace name, a Home link, and
// the signed-in person with Sign out. It does not touch any page's auth or data logic.
export default function AdminLayout({ children }) {
  return (
    <>
      <StaffWorkspaceHeader />
      {children}
    </>
  );
}
