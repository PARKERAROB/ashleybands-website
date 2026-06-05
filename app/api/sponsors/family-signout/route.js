import { NextResponse } from "next/server";
import { clearFamilyCookie } from "@/lib/familyAuthCookie";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearFamilyCookie(res);
  return res;
}
