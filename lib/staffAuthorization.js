import { validateStaffRequest } from "@/lib/staffAuth";
import { staffHasCapability } from "@/lib/staffCapabilities";

export { staffHasCapability, STAFF_CAPABILITIES } from "@/lib/staffCapabilities";

export async function authorizeStaffRequest(request, capability) {
  const staff = await validateStaffRequest(request);
  if (!staff) return { ok: false, status: 401, error: "Not signed in" };
  if (!staffHasCapability(staff, capability)) {
    return { ok: false, status: 403, error: "This staff account does not have access to this operation." };
  }
  return { ok: true, staff };
}
