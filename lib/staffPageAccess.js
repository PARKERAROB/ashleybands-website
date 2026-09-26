import { cookies } from "next/headers";
import { validateStaffRequest } from "@/lib/staffAuth";

// Internal documents are for staff who run the program, not booster or limited roles (#142).
export const INTERNAL_DOC_ROLES = Object.freeze(["director", "program_staff"]);

// Reads the signed staff cookie on the server so a page never renders for a signed-out visitor.
export async function staffFromCookies() {
  try {
    return await validateStaffRequest({ cookies: await cookies() });
  } catch {
    return null;
  }
}

export async function staffCanReadInternalDocs() {
  const staff = await staffFromCookies();
  return Boolean(staff && INTERNAL_DOC_ROLES.includes(staff.role));
}
