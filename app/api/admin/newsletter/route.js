import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { listNewsletterAdmin, saveNewsletterIssue } from "@/lib/newsletter";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

function actor(staff) {
  return { type: "staff", id: staff.id, name: staff.display_name };
}

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;
  try {
    const data = await listNewsletterAdmin();
    await logAudit({
      actor: actor(staff),
      action: "newsletter_admin_list",
      table: "newsletter_contacts",
      changes: { aggregate_only: true },
      route: "/api/admin/newsletter"
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.COMMUNICATIONS_WRITE);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;
  const body = await request.json().catch(() => ({}));
  try {
    const issue = await saveNewsletterIssue(body, staff.display_name);
    await logAudit({
      actor: actor(staff),
      action: body.id ? "newsletter_issue_update" : "newsletter_issue_create",
      table: "newsletter_issues",
      recordId: issue.id,
      changes: { slug: issue.slug, status: issue.status },
      route: "/api/admin/newsletter"
    });
    return NextResponse.json({ ok: true, issue });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
}
