import { NextResponse } from "next/server";
import { validateStaffRequest } from "@/lib/staffAuth";
import { createNewsletterBroadcasts, dispatchNewsletterBroadcast } from "@/lib/newsletter";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  const staff = await validateStaffRequest(request);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: "Send not confirmed." }, { status: 400 });

  try {
    const prepared = await createNewsletterBroadcasts(String(body.issueId || ""), staff.display_name);
    const result = { member: null, public: null };
    if (prepared.broadcasts.member) result.member = await dispatchNewsletterBroadcast(prepared.broadcasts.member);
    if (prepared.broadcasts.public) result.public = await dispatchNewsletterBroadcast(prepared.broadcasts.public);
    await logAudit({
      actor: { type: "staff", id: staff.id, name: staff.display_name },
      action: "newsletter_issue_send",
      table: "broadcasts",
      recordId: prepared.issue.id,
      changes: result,
      route: "/api/admin/newsletter/send"
    });
    return NextResponse.json({ ok: true, broadcasts: prepared.broadcasts, result });
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
}
