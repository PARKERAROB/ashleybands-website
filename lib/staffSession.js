// Shared client-side staff session helpers. Staff sign in once (email + PIN);
// the session is kept in localStorage and reused across every admin dashboard.
// NOTE: Tier-1 roadmap item is to move this to an httpOnly cookie; for now this
// centralizes the duplicated logic that lived in each admin page.

export const STAFF_STORAGE_KEY = "bdos_staff_session_v1";

export function readStaffSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveStaffSession(session) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(session));
}

export function clearStaffSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STAFF_STORAGE_KEY);
}

export function staffAuthHeaders(session) {
  return {
    "Content-Type": "application/json",
    "x-staff-id": session?.id || "",
    "x-staff-token": session?.token || ""
  };
}
