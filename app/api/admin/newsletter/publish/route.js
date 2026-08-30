import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { publishNewsletterIssue } from "@/lib/newsletter";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.COMMUNICATIONS_WRITE);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: "Publication not confirmed." }, { status: 400 });
  try {
    const issue = await publishNewsletterIssue(String(body.issueId || ""), staff.display_name);
    await logAudit({
      actor: { type: "staff", id: staff.id, name: staff.display_name },
      action: "newsletter_issue_publish",
      table: "newsletter_issues",
      recordId: issue.id,
      changes: { slug: issue.slug, status: issue.status },
      route: "/api/admin/newsletter/publish"
    });
    return NextResponse.json({ ok: true, issue });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
}
