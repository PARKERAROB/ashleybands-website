import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { resolveAudience } from "@/lib/audience";

export const runtime = "nodejs";

// Resolve an audience WITHOUT creating or sending anything. Powers the live
// recipient count + sample in the composer.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

  const body = await req.json().catch(() => ({}));
  const audienceFilter = body.audienceFilter || {};
  const recipientAxis = ["students", "guardians", "both"].includes(body.recipientAxis)
    ? body.recipientAxis
    : "guardians";

  const { recipients, count, studentCount, coveredStudentCount } = await resolveAudience(
    audienceFilter,
    recipientAxis
  );

  return NextResponse.json({
    count,
    studentCount,
    coveredStudentCount,
    sample: recipients.slice(0, 10).map((r) => r.email)
  });
}
