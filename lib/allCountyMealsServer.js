import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashToken } from "@/lib/portalTokens";
import { sendAllCountyMealsInvoiceEmail } from "@/lib/portalEmail";
import { EVENT_KEY, buildInvoice, invoiceEmail } from "@/lib/allCountyMeals.mjs";

// Server side of the All-County meals order (#221). The director's edit link carries a random
// token; only its hash is stored. Losing the link means asking for a new one, which replaces it.

export const TABLE = "allcounty_meal_signups";
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

// What the director sees: their order and its invoice. No payment notes, no ids beyond their own.
export function directorView(row) {
  return {
    signup: { director_name: row.director_name, director_email: row.director_email, school: row.school, students: row.students, updated_at: row.updated_at },
    invoice: buildInvoice(row.students, row.price_cents),
  };
}

// Best effort: the invoice is already saved and on screen, so a failed email is reported, not fatal.
export async function emailInvoice(row, url) {
  try {
    const message = invoiceEmail({ signup: row, invoice: buildInvoice(row.students, row.price_cents), editUrl: url });
    await sendAllCountyMealsInvoiceEmail({ to: row.director_email, ...message });
    return true;
  } catch (error) {
    console.error("[allcounty-meals] invoice email failed:", error?.name || "", error?.message || error);
    return false;
  }
}
