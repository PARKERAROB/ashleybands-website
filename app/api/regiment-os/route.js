import { NextResponse } from "next/server";
import encryptedReview from "@/content/regiment-os-review.encrypted.json";
import { validateRegimentOsRequest } from "@/lib/regimentOsAuth";
import { decryptRegimentOsContent } from "@/lib/regimentOsContent";

export const runtime = "nodejs";

export async function GET(request) {
  if (!validateRegimentOsRequest(request)) {
    return NextResponse.json({ error: "Program PIN required." }, { status: 401 });
  }

  return NextResponse.json(decryptRegimentOsContent(encryptedReview), {
    headers: { "Cache-Control": "private, no-store" }
  });
}
