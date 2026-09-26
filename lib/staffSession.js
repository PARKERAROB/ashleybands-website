// Browser display state only: id, role, and display name. Authentication lives
// exclusively in the signed httpOnly cookie and never in these stored values.

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
  notifyStaffSessionChange();
}

export function clearStaffSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STAFF_STORAGE_KEY);
  notifyStaffSessionChange();
}

// Lets the workspace header update its name and role after sign-in or sign-out
// in the same tab. Display only; no credentials travel with the event.
export const STAFF_SESSION_EVENT = "ab-staff-session-change";

function notifyStaffSessionChange() {
  try {
    window.dispatchEvent(new Event(STAFF_SESSION_EVENT));
  } catch {
    // Display refresh only.
  }
}

export function staffAuthHeaders(session) {
  void session;
  // Same-origin fetch sends the httpOnly cookie automatically.
  return { "Content-Type": "application/json" };
}

export async function revokeStaffSession() {
  try {
    const response = await fetch("/api/sponsors/staff-signout", { method: "POST" });
    if (!response.ok) return false;
    clearStaffSession();
    return true;
  } catch {
    return false;
  }
}
