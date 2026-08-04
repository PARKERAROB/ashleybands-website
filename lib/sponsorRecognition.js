import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendBroadcastEmail } from "@/lib/portalEmail";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import { sponsorRecognitionLive } from "@/lib/sponsorFamily";
import { initialSponsorListingState } from "@/lib/sponsorGiftPolicy.mjs";

// Lane A recognition after money is confirmed. Receipts remain automatic, but online sponsor
// names do not publish until staff verifies the requested business identity. Check gifts can be
// listed at confirmation because staff is reconciling them against the physical payment.
//
// L2 posture: the actual receipt/badge EMAIL only goes out when SPONSOR_RECOGNITION_LIVE is
// true. Until then a confirmed gift is fully recorded, but the email is held
// (recognition_status = 'queued_dark') so Rob approves the template once before it ever sends.

const SPONSOR_FROM =
  process.env.SPONSOR_EMAIL_FROM || "Ashley Bands Sponsorships <sponsorship@director.ashleybands.com>";
const SPONSOR_REPLY_TO = process.env.SPONSOR_EMAIL_REPLY_TO || "robert.parker@nhcs.net";

export function dollars(cents) {
  return `$${(Math.round(Number(cents) || 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// Map a gift amount to its recognition tier (matches lib/sponsorshipContent TIERS).
export function tierForAmount(amountCents) {
  const d = (Number(amountCents) || 0) / 100;
  if (d >= 3000) return "Legacy";
  if (d >= 1500) return "Premier";
  if (d >= 750) return "Patron";
  if (d >= 500) return "Partner";
  if (d >= 250) return "Friend";
  return "Supporter";
}

// Conservative fair-market value of any TANGIBLE benefits bundled with a tier, in cents.
// IRS quid-pro-quo: tangible goods (apparel, framed photo) reduce the deductible amount;
// pure acknowledgment (listings, logos, PA reads, banners) does not. Default 0 for online
// gifts (acknowledgment-only); staff can override fmv_cents when a benefit is actually given.
export function estimatedFmvCents(tier) {
  switch (tier) {
    case "Legacy":
    case "Premier":
      return 2500; // sponsor t-shirt (~$20) + framed thank-you photo (~$5 materials)
    case "Patron":
      return 2000; // sponsor t-shirt
    default:
      return 0; // Friend / Partner / Supporter: acknowledgment-only — fully deductible
  }
}

export function computeReceipt({ amountCents, tier, fmvCents }) {
  const t = tier || tierForAmount(amountCents);
  const fmv = Number.isFinite(fmvCents) && fmvCents != null ? Math.max(0, fmvCents) : estimatedFmvCents(t);
  const deductible = Math.max(0, (Number(amountCents) || 0) - fmv);
  return { tier: t, fmvCents: fmv, deductibleCents: deductible };
}

export function receiptNumber(date = new Date()) {
  const year = date.getFullYear();
  return `AHS-SP-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

// Hosted badge URL — a self-marketing "Proud Sponsor of the Bands of Ashley" image the
// sponsor can post. Rendered by app/api/sponsors/badge/route.js (no image deps).
export function badgeUrl(giftId, origin = "https://ashleybands.com") {
  return `${origin.replace(/\/$/, "")}/api/sponsors/badge?id=${encodeURIComponent(giftId || "")}`;
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// The tax receipt + thank-you (acknowledgment letter), built per gift.
export function renderReceiptEmail({
  businessName,
  giftId,
  payerName,
  amountCents,
  fmvCents,
  deductibleCents,
  receiptNo,
  method,
  origin,
  listedOnSite = false
}) {
  const subject = `Your Ashley Bands sponsorship receipt — ${receiptNo}`;
  const fmvLine =
    fmvCents > 0
      ? `Fair market value of benefits received: ${dollars(fmvCents)}\nTax-deductible portion of your gift: ${dollars(deductibleCents)}`
      : `This gift was acknowledgment-only (program/website listing). The full amount is tax-deductible: ${dollars(deductibleCents)}`;

  const recognitionLine = listedOnSite
    ? `Your "Proud Sponsor of the Bands of Ashley" badge: ${badgeUrl(giftId, origin)}\nYou're now listed at ${SPONSOR_CONTACT.sponsorsUrl}.`
    : "We will verify the sponsor recognition name before it appears on the Ashley Bands website.";
  const text = [
    `Thank you for sponsoring the Bands of Ashley High School.`,
    "",
    `Payment received from: ${payerName || "Sponsor"}`,
    `Sponsor recognition name: ${businessName}`,
    `Gift amount: ${dollars(amountCents)}`,
    `Method: ${method}`,
    `Receipt number: ${receiptNo}`,
    "",
    fmvLine,
    "",
    `${SPONSOR_CONTACT.boosterOrg} is a registered 501(c)(3) educational nonprofit. EIN ${SPONSOR_CONTACT.ein}. No goods or services were provided in exchange for this contribution except as noted above.`,
    "",
    recognitionLine,
    "",
    `With gratitude,`,
    `${SPONSOR_CONTACT.director}, ${SPONSOR_CONTACT.title}`,
    SPONSOR_CONTACT.school
  ].join("\n");

  const html = [
    `<p>Thank you for sponsoring the Bands of Ashley High School.</p>`,
    `<table style="border-collapse:collapse;font-size:14px">`,
    `<tr><td style="padding:2px 12px 2px 0;color:#6f675a">Payment received from</td><td><strong>${esc(payerName || "Sponsor")}</strong></td></tr>`,
    `<tr><td style="padding:2px 12px 2px 0;color:#6f675a">Sponsor recognition name</td><td><strong>${esc(businessName)}</strong></td></tr>`,
    `<tr><td style="padding:2px 12px 2px 0;color:#6f675a">Gift amount</td><td>${dollars(amountCents)}</td></tr>`,
    `<tr><td style="padding:2px 12px 2px 0;color:#6f675a">Method</td><td>${esc(method)}</td></tr>`,
    `<tr><td style="padding:2px 12px 2px 0;color:#6f675a">Receipt #</td><td>${esc(receiptNo)}</td></tr>`,
    `</table>`,
    fmvCents > 0
      ? `<p style="font-size:14px">Fair market value of benefits received: <strong>${dollars(fmvCents)}</strong><br/>Tax-deductible portion of your gift: <strong>${dollars(deductibleCents)}</strong></p>`
      : `<p style="font-size:14px">This gift was acknowledgment-only (program/website listing). The full amount is tax-deductible: <strong>${dollars(deductibleCents)}</strong>.</p>`,
    `<p style="color:#6f675a;font-size:13px">${esc(SPONSOR_CONTACT.boosterOrg)} is a registered 501(c)(3) educational nonprofit. EIN ${esc(SPONSOR_CONTACT.ein)}. No goods or services were provided in exchange for this contribution except as noted above.</p>`,
    listedOnSite
      ? `<p style="font-size:14px"><a href="${esc(badgeUrl(giftId, origin))}">Download your &ldquo;Proud Sponsor of the Bands of Ashley&rdquo; badge</a>. You&apos;re now listed at ${esc(SPONSOR_CONTACT.sponsorsUrl)}.</p>`
      : `<p style="font-size:14px">We will verify the sponsor recognition name before it appears on the Ashley Bands website.</p>`,
    `<p style="font-size:14px">With gratitude,<br/>${esc(SPONSOR_CONTACT.director)}, ${esc(SPONSOR_CONTACT.title)}<br/>${esc(SPONSOR_CONTACT.school)}</p>`
  ].join("");

  return { subject, text, html };
}

// Confirm a gift and fire Lane A. Idempotent: a gift already 'confirmed' is returned as-is.
// `origin` lets the caller pass the deployed origin so badge/receipt links are absolute.
export async function confirmGift(
  giftId,
  { confirmedBy = "system", origin, listOnSite = initialSponsorListingState(), receiptEmail } = {}
) {
  const { data: gift, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .select(
      "id, business_id, business_name, amount_cents, method, status, tier, fmv_cents, payer_name, payer_email, receipt_number, receipt_sent_at, recognition_status, listed_on_site, business:businesses(name_display)"
    )
    .eq("id", giftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!gift) throw new Error("Gift not found.");
  if (gift.status === "confirmed") {
    return { ok: true, alreadyConfirmed: true, gift };
  }

  const businessName = gift.business_name || gift.business?.name_display || "Our sponsor";
  const { tier, fmvCents, deductibleCents } = computeReceipt({
    amountCents: gift.amount_cents,
    tier: gift.tier,
    fmvCents: gift.fmv_cents
  });
  const receiptNo = gift.receipt_number || receiptNumber();
  const now = new Date().toISOString();

  const update = {
    status: "confirmed",
    confirmed_at: now,
    confirmed_by: confirmedBy,
    received_at: now,
    tier,
    fmv_cents: fmvCents,
    deductible_cents: deductibleCents,
    receipt_number: receiptNo,
    listed_on_site: listOnSite === true,
    business_name: businessName
  };

  // First claim the pending row. This prevents the browser capture and PayPal webhook from
  // both sending a receipt when they arrive at nearly the same time.
  update.recognition_status = "queued_dark";
  const { data: confirmed, error: upErr } = await supabaseAdmin
    .from("sponsor_gifts")
    .update(update)
    .eq("id", giftId)
    .eq("status", "pending")
    .select("id, status, tier, amount_cents, fmv_cents, deductible_cents, receipt_number, recognition_status, listed_on_site")
    .maybeSingle();
  if (upErr) throw new Error(upErr.message);
  if (!confirmed) return { ok: true, alreadyConfirmed: true, gift };

  const recipient = receiptEmail === undefined ? gift.payer_email : receiptEmail;
  let recognitionStatus = "queued_dark";
  if (sponsorRecognitionLive() && recipient) {
    try {
      const email = renderReceiptEmail({
        businessName,
        giftId: gift.id,
        payerName: gift.payer_name,
        amountCents: gift.amount_cents,
        fmvCents,
        deductibleCents,
        receiptNo,
        method: gift.method,
        origin,
        listedOnSite: listOnSite === true
      });
      await sendBroadcastEmail({
        to: recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
        from: SPONSOR_FROM,
        replyTo: SPONSOR_REPLY_TO
      });
      recognitionStatus = "sent";
    } catch {
      recognitionStatus = "failed";
    }
  }
  const recognitionUpdate = {
    recognition_status: recognitionStatus,
    ...(recognitionStatus === "sent" ? { receipt_sent_at: now } : {}),
    ...(recognitionStatus === "sent" && listOnSite === true ? { badge_sent_at: now } : {})
  };
  const { data: finalized, error: recognitionError } = await supabaseAdmin
    .from("sponsor_gifts")
    .update(recognitionUpdate)
    .eq("id", giftId)
    .select("id, status, tier, amount_cents, fmv_cents, deductible_cents, receipt_number, recognition_status")
    .single();
  if (recognitionError) throw new Error(recognitionError.message);

  return { ok: true, gift: finalized, recognitionStatus };
}
