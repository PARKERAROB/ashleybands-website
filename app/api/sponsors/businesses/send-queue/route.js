import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";
import { countQueued, dispatchOutreachQueue } from "@/lib/businessOutreachSend";

export const runtime = "nodejs";
// Allow time for a real send loop (Resend per recipient). Vercel Pro honors this.
export const maxDuration = 300;

// How many are staged to send. Drives the dashboard "Send queued (N)" button.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  return privateJson({ queued: await countQueued() });
}

// L2 BOUNDARY: only runs on a staff member's authenticated click, and only when
// the client affirms `confirm: true` after seeing the count. No schedule, no cron,
// no auto-send. Mirrors the parent-broadcast send gate.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_OUTREACH_SEND);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  const body = await req.json().catch(() => ({}));
  const queued = await countQueued();
  if (!queued) return privateJson({ error: "Nothing is queued to send." }, 400);

  if (body.confirm !== true) {
    // Confirmation gate: tell the client the count, don't send yet.
    return privateJson({ needsConfirm: true, queued });
  }

  const limit = Number.isFinite(body.limit) && body.limit > 0 ? Math.floor(body.limit) : 0;
  try {
    await logAuditRequired({ actor: staffActor(authorization.staff), action: "send_requested", table: "business_outreach", recordId: "queued-sponsorship-outreach", route: "/api/sponsors/businesses/send-queue", changes: { queued, limit } });
    const result = await dispatchOutreachQueue({ limit });
    return privateJson({ ok: true, ...result });
  } catch (err) {
    return privateServerError("sponsor-send-queue", err, "Sponsor outreach could not be sent.");
  }
}
