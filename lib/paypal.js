// PayPal Orders v2 helper. Server-side only — uses PAYPAL_CLIENT_SECRET.
// No card data ever touches our servers; PayPal hosts the payment sheet.

const PAYPAL_ENV = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();

export function paypalBaseUrl() {
  return PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function isPaypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// cents (integer) -> "12.34" string PayPal expects
export function centsToAmount(cents) {
  const n = Math.round(Number(cents) || 0);
  return (n / 100).toFixed(2);
}

// "12.34" -> 1234 cents
export function amountToCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error("PayPal is not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).");
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed (${res.status}): ${detail}`);
  }
  const json = await res.json();
  return json.access_token;
}

// Create a CAPTURE order. studentId -> custom_id, invoiceId -> invoice_id (our id).
export async function createOrder({ amountCents, studentId, invoiceId, description, requestId }) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": String(requestId) } : {})
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: String(studentId),
          invoice_id: String(invoiceId),
          description: (description || "Ashley Bands fee payment").slice(0, 127),
          amount: {
            currency_code: "USD",
            value: centsToAmount(amountCents)
          }
        }
      ]
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PayPal create order failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

// Capture an approved order. Returns the capture detail.
export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PayPal capture failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

// Refund a completed PayPal capture. The database is updated only after PayPal
// accepts the refund, so the financial ledger never claims a refund that did
// not reach the processor.
export async function refundCapture(captureId, { requestId } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": String(requestId) } : {})
    },
    body: "{}"
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PayPal refund failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

export async function getOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal order lookup failed (${res.status}).`);
  return json;
}

// Pull the meaningful bits out of a capture/order response.
export function extractCapture(orderJson) {
  const unit = orderJson?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    orderId: orderJson?.id || "",
    status: orderJson?.status || "",
    captureId: capture?.id || "",
    captureStatus: capture?.status || "",
    invoiceId: capture?.invoice_id || unit?.invoice_id || "",
    customId: capture?.custom_id || unit?.custom_id || "",
    amountValue: capture?.amount?.value || unit?.amount?.value || "",
    currencyCode: capture?.amount?.currency_code || unit?.amount?.currency_code || "",
    payerEmail: orderJson?.payer?.email_address || "",
    payerName: [orderJson?.payer?.name?.given_name, orderJson?.payer?.name?.surname].filter(Boolean).join(" ")
  };
}

// Verify a webhook signature against PAYPAL_WEBHOOK_ID. Returns true if PayPal
// confirms the event is authentic.
export async function verifyWebhookSignature({ headers, body }) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured.");

  const token = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: body
    })
  });
  if (!res.ok) return false;
  const json = await res.json().catch(() => ({}));
  return json.verification_status === "SUCCESS";
}
