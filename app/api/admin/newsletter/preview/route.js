import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { previewNewsletterAudience } from "@/lib/newsletter";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;
  try {
    const counts = await previewNewsletterAudience();
    await logAudit({
      actor: { type: "staff", id: staff.id, name: staff.display_name },
      action: "newsletter_audience_preview",
      table: "newsletter_contacts",
      changes: counts,
      route: "/api/admin/newsletter/preview"
    });
    return NextResponse.json(counts);
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
