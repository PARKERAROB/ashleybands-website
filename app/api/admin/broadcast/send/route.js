import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { createBroadcast, dispatchBroadcast } from "@/lib/broadcast";

export const runtime = "nodejs";
// Allow time for a real send loop (Resend per recipient). Vercel Pro honors this.
export const maxDuration = 300;

// L2 BOUNDARY: this only runs on Rob's authenticated click. There is no schedule,
// no cron, no auto-send anywhere. Two modes:
//   { broadcastId }                       -> resume dispatch of an existing broadcast
//   { subject, body, audienceFilter, recipientAxis, confirm:true } -> create + send
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.COMMUNICATIONS_SEND);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));

  // Resume mode: finish sending a broadcast that already exists.
  if (body.broadcastId) {
    try {
      const result = await dispatchBroadcast(String(body.broadcastId));
      return NextResponse.json({ ok: true, broadcastId: body.broadcastId, ...result });
    } catch (err) {
      return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
    }
  }

  // Create + send mode.
  const subject = String(body.subject || "").trim();
  const compose = String(body.body || "").trim();
  const audienceFilter = body.audienceFilter || {};
  const recipientAxis = ["students", "guardians", "both"].includes(body.recipientAxis)
    ? body.recipientAxis
    : "guardians";

  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!compose) return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  // Explicit confirmation gate — the client must affirm after seeing the count.
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Send not confirmed." }, { status: 400 });
  }

  try {
    const created = await createBroadcast({
      subject,
      body: compose,
      audienceFilter,
      recipientAxis,
      createdBy: staff.display_name
    });

    if (!created.broadcastId || !created.count) {
      return NextResponse.json(
        { error: "No recipients matched this audience." },
        { status: 400 }
      );
    }

    const result = await dispatchBroadcast(created.broadcastId);
    return NextResponse.json({
      ok: true,
      broadcastId: created.broadcastId,
      recipientCount: created.count,
      studentCount: created.studentCount,
      ...result
    });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
