import { NextResponse } from "next/server";
import { validateStaffRequest } from "@/lib/staffAuth";
import { previewNewsletterAudience } from "@/lib/newsletter";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(request) {
  const staff = await validateStaffRequest(request);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
