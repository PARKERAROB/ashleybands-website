import bcrypt from "bcryptjs";

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
  return {
    staffId: req.headers.get("x-staff-id") || "",
    token: req.headers.get("x-staff-token") || ""
  };
}
