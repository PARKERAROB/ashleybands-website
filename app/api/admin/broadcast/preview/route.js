import { NextResponse } from "next/server";
import { validateStaffRequest } from "@/lib/staffAuth";
import { resolveAudience } from "@/lib/audience";

export const runtime = "nodejs";

// Resolve an audience WITHOUT creating or sending anything. Powers the live
// recipient count + sample in the composer.
export async function POST(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const audienceFilter = body.audienceFilter || {};
  const recipientAxis = ["students", "guardians", "both"].includes(body.recipientAxis)
    ? body.recipientAxis
    : "guardians";

  const { recipients, count, studentCount } = await resolveAudience(
    audienceFilter,
    recipientAxis
  );

  return NextResponse.json({
    count,
    studentCount,
    sample: recipients.slice(0, 10).map((r) => r.email)
  });
}
