import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { confirmGift } from "@/lib/sponsorRecognition";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Staff actions on a gift (build-spec §6 L2 boundary lives here): confirm a check pledge
// once the money is in hand → fires Lane A recognition (receipt + auto-list + badge). Also
// supports correcting the amount / FMV before confirming, and voiding a pledge that never
// arrived. Staff-only. (Online gifts auto-confirm at PayPal capture and don't need this.)
function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

export async function PATCH(req, { params }) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));

  // Optional pre-confirm corrections.
  const pre = {};
  if (Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0) {
    pre.amount_cents = Math.round(Number(body.amount_cents));
  }
  if (Number.isFinite(Number(body.fmv_cents)) && Number(body.fmv_cents) >= 0) {
    pre.fmv_cents = Math.round(Number(body.fmv_cents));
  }
  if (typeof body.payer_email === "string") pre.payer_email = body.payer_email.trim();
  if (typeof body.notes === "string") pre.notes = body.notes;
  const requestedAction = ["confirm", "void", "unlist", "list"].includes(body.action)
    ? `${body.action}_requested`
    : Object.keys(pre).length ? "update_requested" : null;
  if (requestedAction) {
    try {
      await logAuditRequired({
        actor: staffActor(staff),
        action: requestedAction,
        table: "sponsor_gifts",
        recordId: id,
        route: "/api/sponsors/gifts/[id]",
        changes: { fields: Object.keys(pre) },
      });
    } catch (error) {
      return privateServerError("sponsor-gift-audit", error, "The sponsor gift could not be updated.");
    }
  }
  if (Object.keys(pre).length) {
    const { error } = await supabaseAdmin.from("sponsor_gifts").update(pre).eq("id", id).eq("status", "pending");
    if (error) return privateServerError("sponsor-gift", error, "The sponsor gift could not be updated.");
  }

  if (body.action === "confirm") {
    try {
      const result = await confirmGift(id, {
        confirmedBy: staff.display_name || "staff",
        origin: siteOrigin(req),
        listOnSite: true
      });
      return privateJson(result);
    } catch (err) {
      return privateServerError("sponsor-gift", err, "The sponsor gift could not be confirmed.");
    }
  }

  if (body.action === "void") {
    const { error } = await supabaseAdmin
      .from("sponsor_gifts")
      .update({ status: "void", listed_on_site: false })
      .eq("id", id);
    if (error) return privateServerError("sponsor-gift", error, "The sponsor gift could not be voided.");
    return privateJson({ ok: true, status: "void" });
  }

  if (body.action === "unlist") {
    const { error } = await supabaseAdmin
      .from("sponsor_gifts")
      .update({ listed_on_site: false })
      .eq("id", id);
    if (error) return privateServerError("sponsor-gift", error, "The sponsor gift could not be unpublished.");
    return privateJson({ ok: true });
  }

  if (body.action === "list") {
    const { data, error } = await supabaseAdmin
      .from("sponsor_gifts")
      .update({ listed_on_site: true })
      .eq("id", id)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();
    if (error) return privateServerError("sponsor-gift", error, "The sponsor gift could not be published.");
    if (!data) return privateJson({ error: "Only confirmed gifts can be published." }, 409);
    return privateJson({ ok: true, listed_on_site: true });
  }
  return privateJson({ ok: true, updated: Object.keys(pre) });
}
