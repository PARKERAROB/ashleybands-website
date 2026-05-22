import { NextResponse } from "next/server";
import { getPortalEmailConfig } from "@/lib/portalEmail";

export const runtime = "nodejs";

export function GET() {
  const config = getPortalEmailConfig();
  return NextResponse.json({
    configured: config.configured,
    fromAddress: config.fromAddress,
    reviewTo: config.reviewTo
  });
}
