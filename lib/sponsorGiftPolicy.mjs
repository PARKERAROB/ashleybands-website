import crypto from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bounded(value, { label, max, required = false } = {}) {
  const clean = String(value || "").trim();
  if (required && !clean) throw new Error(`${label} is required.`);
  if (clean.length > max) throw new Error(`${label} is too long.`);
  return clean;
}

export function normalizePublicGiftInput(body = {}) {
  const requestKey = String(body.request_key || "").trim().toLowerCase();
  if (!UUID_RE.test(requestKey)) {
    throw new Error("Please start this gift again so we can create a secure request.");
  }

  const businessName = bounded(body.business_name, {
    label: "Donor or business name",
    max: 160,
    required: true
  });
  const payerName = bounded(body.payer_name, { label: "Payer name", max: 160 });
  const payerEmail = bounded(body.payer_email, { label: "Payer email", max: 254 }).toLowerCase();
  if (payerEmail && !EMAIL_RE.test(payerEmail)) {
    throw new Error("Enter a valid email for the receipt.");
  }

  return { requestKey, businessName, payerName, payerEmail };
}

export function giftInvoiceIdForRequest(requestKey) {
  const normalized = String(requestKey || "").trim().toLowerCase();
  if (!UUID_RE.test(normalized)) throw new Error("Invalid gift request key.");
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 20).toUpperCase();
  return `AB-SP-${digest}`;
}

export function sponsorThankYouLine(businessName) {
  const name = String(businessName || "").trim();
  return name ? `Thank you, ${name}, for supporting the Bands of Ashley.` : "";
}

export function legacySponsorPinEnabled(value) {
  return String(value || "").toLowerCase() === "true";
}

export function initialSponsorListingState() {
  return false;
}

export function reconcileGiftAttribution({ tokenClaims, prospect, business }) {
  if (!tokenClaims?.businessId || !tokenClaims?.prospectId) {
    throw new Error("This sponsorship link is incomplete.");
  }
  if (!prospect || prospect.id !== tokenClaims.prospectId) {
    throw new Error("This sponsorship link no longer matches a prospect.");
  }
  if (prospect.business_id !== tokenClaims.businessId) {
    throw new Error("This sponsorship link does not match that business.");
  }
  if (!business || business.id !== tokenClaims.businessId) {
    throw new Error("This sponsorship link no longer matches a business.");
  }
  return {
    businessId: business.id,
    prospectId: prospect.id,
    familyId: prospect.family_id || null,
    businessName: String(business.name_display || "").trim()
  };
}

export function isSponsorInvoiceId(invoiceId) {
  return String(invoiceId || "").toUpperCase().startsWith("AB-SP-");
}

export function webhookSettlementPlan(eventType, invoiceId) {
  const sponsor = isSponsorInvoiceId(invoiceId);
  if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    return { ledger: sponsor ? "sponsor" : "family", status: sponsor ? "confirmed" : "completed" };
  }
  if (eventType === "PAYMENT.CAPTURE.REFUNDED" || eventType === "PAYMENT.CAPTURE.REVERSED") {
    return { ledger: sponsor ? "sponsor" : "family", status: "refunded" };
  }
  return null;
}

export function paypalCaptureMatchesGift(capture, gift, amountToCents) {
  return Boolean(
    capture
      && gift
      && capture.invoiceId === gift.invoice_id
      && capture.customId === gift.id
      && amountToCents(capture.amountValue) === gift.amount_cents
  );
}
