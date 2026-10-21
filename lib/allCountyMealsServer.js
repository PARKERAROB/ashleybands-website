import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashToken } from "@/lib/portalTokens";
import { sendAllCountyMealsInvoiceEmail } from "@/lib/portalEmail";
import { campaignOnlineReady } from "@/lib/sponsorCampaigns.mjs";
import { EVENT_KEY, buildInvoice, invoiceEmail, onlineSurchargeCents } from "@/lib/allCountyMeals.mjs";

export { captureMatchesPayment } from "@/lib/allCountyMeals.mjs";

// Server side of the All-County meals order (#221). The director's edit link carries a random
// token; only its hash is stored. Losing the link means asking for a new one, which replaces it.

export const TABLE = "allcounty_meal_signups";
export const PAYMENTS = "allcounty_meal_payments";
export const STAFF_FIELDS = "id,director_name,director_email,school,students,price_cents,total_cents,paid_cents,paid_method,paid_recorded_at,updated_at";
const DIRECTOR_FIELDS = "id,director_name,director_email,school,students,price_cents,updated_at";

export function newEditToken() {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function editUrl(request, token) {
  return `${new URL(request.url).origin}/all-county/meals?edit=${encodeURIComponent(token)}`;
}

export async function findByToken(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { data, error } = await supabaseAdmin.from(TABLE).select(DIRECTOR_FIELDS).eq("event_key", EVENT_KEY).eq("edit_token_hash", hashToken(token)).maybeSingle();
  if (error) throw error;
  return data;
}

// Same key as the unique index. Emails are stored lowercased by cleanSignup.
export async function findExisting(email, school) {
  const { data, error } = await supabaseAdmin.from(TABLE).select("id,school").eq("event_key", EVENT_KEY).eq("director_email", email);
  if (error) throw error;
  return (data || []).find((row) => row.school.toLowerCase() === school.toLowerCase()) || null;
}

export async function findByEmail(email) {
  const { data, error } = await supabaseAdmin.from(TABLE).select(DIRECTOR_FIELDS).eq("event_key", EVENT_KEY).eq("director_email", email);
  if (error) throw error;
  return data || [];
}

// Settled online meal money for one order (surcharges excluded).
export async function onlinePaidCents(signupId) {
  const { data, error } = await supabaseAdmin.from(PAYMENTS).select("meal_cents").eq("signup_id", signupId).eq("status", "completed");
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + row.meal_cents, 0);
}

// What the director sees: their order, its invoice, and what they have paid online.
// Staff-recorded check and cash stay off this view.
export function directorView(row, onlineCents = 0) {
  const invoice = buildInvoice(row.students, row.price_cents);
  const dueCents = Math.max(invoice.totalCents - onlineCents, 0);
  return {
    signup: { director_name: row.director_name, director_email: row.director_email, school: row.school, students: row.students, updated_at: row.updated_at },
    invoice,
    payment: { onlineCents, dueCents, surchargeCents: onlineSurchargeCents(dueCents) },
  };
}

// Best effort: the invoice is already saved and on screen, so a failed email is reported, not fatal.
export async function emailInvoice(row, url, onlineCents = 0) {
  try {
    const invoice = buildInvoice(row.students, row.price_cents);
    const message = invoiceEmail({ signup: row, invoice, editUrl: url, dueCents: Math.max(invoice.totalCents - onlineCents, 0) });
    await sendAllCountyMealsInvoiceEmail({ to: row.director_email, ...message });
    return true;
  } catch (error) {
    console.error("[allcounty-meals] invoice email failed:", error?.name || "", error?.message || error);
    return false;
  }
}

// Same gate as Carnegie online giving: matching credentials, and live PayPal in production.
export function onlinePaymentAvailable() {
  return campaignOnlineReady(process.env);
}

// Idempotent: only a pending row moves to completed, so the capture response and the webhook
// can both arrive without double counting.
export async function settlePayment(payment, captureId) {
  const { data, error } = await supabaseAdmin.from(PAYMENTS)
    .update({ status: "completed", paypal_capture_id: captureId, completed_at: new Date().toISOString() })
    .eq("id", payment.id).eq("status", "pending").select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
