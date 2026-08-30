import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { createBroadcast, dispatchBroadcast } from "@/lib/broadcast";
import { resolveAudience } from "@/lib/audience";
import { enforcedBroadcastAudience, verifyAudienceConfirmation } from "@/lib/broadcastAudienceConfirmation";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";
// Allow time for a real send loop (Resend per recipient). Vercel Pro honors this.
export const maxDuration = 300;

// L2 BOUNDARY: this only runs on Rob's authenticated click. There is no schedule,
// no cron, no auto-send anywhere. Two modes:
//   { broadcastId }                       -> resume dispatch of an existing broadcast
//   { subject, body, audienceFilter, recipientAxis, confirm:true } -> create + send
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.COMMUNICATIONS_SEND);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));

  // Resume mode: finish sending a broadcast that already exists.
  if (body.broadcastId) {
    try {
      await logAuditRequired({ actor: staffActor(staff), action: "resume_broadcast_requested", table: "broadcasts,broadcast_recipients", recordId: String(body.broadcastId), route: "/api/admin/broadcast/send" });
      const result = await dispatchBroadcast(String(body.broadcastId));
      return privateJson({ ok: true, broadcastId: body.broadcastId, ...result });
    } catch (err) {
      return privateServerError("broadcast-resume", err, "The broadcast could not be resumed.");
    }
  }

  // Create + send mode.
  const subject = String(body.subject || "").trim();
  const compose = String(body.body || "").trim();
  const { audienceFilter, recipientAxis, directStudentId } = enforcedBroadcastAudience(body);

  if (!subject) return privateJson({ error: "Subject is required." }, 400);
  if (!compose) return privateJson({ error: "Message body is required." }, 400);
  // Explicit confirmation gate — the client must affirm after seeing the count.
  if (body.confirm !== true) {
    return privateJson({ error: "Send not confirmed." }, 400);
  }

  try {
    const audience = await resolveAudience(audienceFilter, recipientAxis);
    if (!verifyAudienceConfirmation(body.confirmationToken, {
      staffId: staff.id,
      audienceFilter,
      recipientAxis,
      recipients: audience.recipients,
    })) {
      return privateJson({ error: "The audience changed or the preview expired. Preview recipients again before sending." }, 409);
    }
    await logAuditRequired({
      actor: staffActor(staff),
      action: "send_broadcast_requested",
      table: "broadcasts,broadcast_recipients",
      recordId: directStudentId || `audience:${audience.studentCount}`,
      route: "/api/admin/broadcast/send",
      changes: { direct_student_id: directStudentId || null, recipient_axis: recipientAxis, recipient_count: audience.count, subject },
    });
    const created = await createBroadcast({
      subject,
      body: compose,
      audienceFilter,
      recipientAxis,
      createdBy: staff.display_name,
      resolvedAudience: audience,
    });

    if (!created.broadcastId || !created.count) {
      return privateJson({ error: "No recipients matched this audience." }, 400);
    }

    const result = await dispatchBroadcast(created.broadcastId);
    return privateJson({
      ok: true,
      broadcastId: created.broadcastId,
      recipientCount: created.count,
      studentCount: created.studentCount,
      ...result
    });
  } catch (err) {
    return privateServerError("broadcast-send", err, "The broadcast could not be sent.");
  }
}
