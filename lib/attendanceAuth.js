import crypto from "node:crypto";
import { validateStaffRequest } from "@/lib/staffAuth";

const ATTENDANCE_COOKIE = "ab_attendance_session";
const MAX_AGE_SECONDS = 60 * 60 * 18;

function getSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return secret;
}

export function createAttendanceCookieValue() {
  const body = {
    scope: "band-camp-attendance",
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readSharedAttendanceCookie(request) {
  const cookie = request?.cookies?.get?.(ATTENDANCE_COOKIE)?.value;
  if (!cookie) return false;
  const [encoded, signature] = cookie.split(".");
  if (!encoded || !signature) return false;

  try {
    const expected = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.scope === "band-camp-attendance"
      && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function validateAttendanceRequest(request) {
  const staff = await validateStaffRequest(request);
  if (staff) {
    return {
      actor: { type: "staff", id: staff.id, name: staff.display_name },
      access: "staff"
    };
  }
  if (readSharedAttendanceCookie(request)) {
    return {
      actor: { type: "system", name: "Shared attendance PIN" },
      access: "shared_pin"
    };
  }
  return null;
}

export function setAttendanceCookie(response, value) {
  response.cookies.set(ATTENDANCE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearAttendanceCookie(response) {
  response.cookies.set(ATTENDANCE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
