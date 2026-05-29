import { NextResponse } from "next/server";
import { clearStaffCookie } from "@/lib/staffAuthCookie";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearStaffCookie(res);
  return res;
}
