import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { privateJson } from "@/lib/privateResponse";
import { EVENT_KEY, MEAL_PRICE_CENTS, SIGNUP_DEADLINE_LABEL, buildInvoice, cleanSignup, signupsOpen } from "@/lib/allCountyMeals.mjs";
import { TABLE, directorView, editUrl, emailInvoice, findByEmail, findByToken, findExisting, newEditToken, onlinePaidCents } from "@/lib/allCountyMealsServer";

export const runtime = "nodejs";

// Public All-County meals order (#221). Directors create an order, reload it with their private
// edit link, change it, or ask for a new link. Every action is rate limited and fails closed.
// Responses never list other schools' orders.

const LIMITS = { create: 10, load: 40, update: 30, resend: 5 };
const CLOSED = `Meal orders closed ${SIGNUP_DEADLINE_LABEL}. Please email Mr. Parker at robert.parker@nhcs.net.`;
const FAILED = "We could not save your order. Please try again or email Mr. Parker.";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid request." }, 400);
  const action = LIMITS[body.action] ? body.action : null;
  if (!action) return privateJson({ error: "Invalid request." }, 400);
  const limit = await checkRateLimit({ key: `allcounty-meals:${action}:${clientIp(request)}`, limit: LIMITS[action], windowMs: 10 * 60 * 1000, failOpen: false });
  if (!limit.allowed) return privateJson({ error: "Too many requests from this network. Please try again in a few minutes." }, 429);
  // Honeypot: people never see this field. Answer as if saved so bots learn nothing.
  if (typeof body.website === "string" && body.website.trim()) return privateJson({ ok: true });

  try {
    if (action === "load") return await load(body);
    if (action === "resend") return await resend(request, body);
    if (!signupsOpen()) return privateJson({ error: CLOSED }, 403);
    return action === "create" ? await create(request, body) : await update(request, body);
  } catch (error) {
    console.error("[allcounty-meals]", action, error?.message || error);
    return privateJson({ error: FAILED }, 500);
  }
}

async function load(body) {
  const row = await findByToken(body.token);
  if (!row) return privateJson({ error: "That edit link is not valid. Ask for a new one below." }, 404);
  return privateJson({ ...directorView(row, await onlinePaidCents(row.id)), open: signupsOpen() });
}

async function create(request, body) {
  const cleaned = cleanSignup(body);
  if (cleaned.error) return privateJson({ error: cleaned.error }, 400);
  const value = cleaned.value;
  if (await findExisting(value.director_email, value.school)) return duplicate();
  const { token, hash } = newEditToken();
  const invoice = buildInvoice(value.students, MEAL_PRICE_CENTS);
  const { data: row, error } = await supabaseAdmin.from(TABLE)
    .insert({ ...value, event_key: EVENT_KEY, price_cents: MEAL_PRICE_CENTS, total_cents: invoice.totalCents, edit_token_hash: hash })
    .select("id,director_name,director_email,school,students,price_cents,updated_at").single();
  if (error?.code === "23505") return duplicate();
  if (error) throw error;
  const url = editUrl(request, token);
  const emailed = await emailInvoice(row, url);
  return privateJson({ ...directorView(row), open: true, editToken: token, emailed });
}

async function update(request, body) {
  const current = await findByToken(body.token);
  if (!current) return privateJson({ error: "That edit link is not valid. Ask for a new one below." }, 404);
  const cleaned = cleanSignup(body, { minStudents: 0 });
  if (cleaned.error) return privateJson({ error: cleaned.error }, 400);
  const value = cleaned.value;
  const other = await findExisting(value.director_email, value.school);
  if (other && other.id !== current.id) return duplicate();
  const invoice = buildInvoice(value.students, MEAL_PRICE_CENTS);
  const { data: row, error } = await supabaseAdmin.from(TABLE)
    .update({ ...value, price_cents: MEAL_PRICE_CENTS, total_cents: invoice.totalCents, updated_at: new Date().toISOString() })
    .eq("id", current.id).select("id,director_name,director_email,school,students,price_cents,updated_at").single();
  if (error?.code === "23505") return duplicate();
  if (error) throw error;
  const online = await onlinePaidCents(row.id);
  const emailed = await emailInvoice(row, editUrl(request, body.token), online);
  return privateJson({ ...directorView(row, online), open: true, editToken: body.token, emailed });
}

// Sends a fresh edit link for each order under this email. The old link stops working.
// Same answer whether or not an order exists, so the form cannot be used to look up directors.
async function resend(request, body) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254) return privateJson({ error: "Please enter your email address." }, 400);
  const perEmail = await checkRateLimit({ key: `allcounty-meals:resend-email:${email}`, limit: 3, windowMs: 60 * 60 * 1000, failOpen: false });
  if (perEmail.allowed) {
    for (const row of await findByEmail(email)) {
      const { token, hash } = newEditToken();
      const { error } = await supabaseAdmin.from(TABLE).update({ edit_token_hash: hash }).eq("id", row.id);
      if (error) throw error;
      await emailInvoice(row, editUrl(request, token), await onlinePaidCents(row.id));
    }
  }
  return privateJson({ ok: true, message: "If we have an order under that email, a new edit link is on its way. Check your inbox in a few minutes." });
}

function duplicate() {
  return privateJson({ error: "You already have an order for this school. Use the edit link in your invoice email, or ask for a new link below." }, 409);
}
