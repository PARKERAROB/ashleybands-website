import { NextResponse } from "next/server";
import { clearPortalSessionCookie } from "@/lib/portalTokens";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearPortalSessionCookie(response);
  return response;
}
