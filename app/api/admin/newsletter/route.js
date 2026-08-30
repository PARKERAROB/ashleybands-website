import { NextResponse } from "next/server";
import { validateStaffRequest } from "@/lib/staffAuth";
import { listNewsletterAdmin, saveNewsletterIssue } from "@/lib/newsletter";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

function actor(staff) {
  return { type: "staff", id: staff.id, name: staff.display_name };
}

export async function GET(request) {
  const staff = await validateStaffRequest(request);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
  const staff = await validateStaffRequest(request);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
