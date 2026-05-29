import bcrypt from "bcryptjs";
import { readStaffCookie } from "@/lib/staffAuthCookie";

export function hashPin(pin) {
  return bcrypt.hashSync(String(pin), 10);
}

export function verifyPin(pin, hash) {
  return bcrypt.compareSync(String(pin), String(hash || ""));
}

export function readFamilySession(req) {
  return {
    familyId: req.headers.get("x-family-id") || "",
    token: req.headers.get("x-family-token") || ""
  };
}

export function readStaffSession(req) {
  // Prefer the httpOnly cookie; fall back to legacy x-staff-* headers so
  // already-signed-in sessions keep working during/after the cookie rollout.
  const cookie = readStaffCookie(req);
  if (cookie?.id && cookie?.token) {
    return { staffId: cookie.id, token: cookie.token };
  }
  return {
    staffId: req.headers.get("x-staff-id") || "",
    token: req.headers.get("x-staff-token") || ""
  };
}
