import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PRIVATE_RESPONSE_HEADERS, privateJson } from "@/lib/privateResponse";
import { EVENT_KEY, MEALS, MEAL_PRICE_CENTS, SIGNUP_DEADLINE, staffSummary, summaryCsv } from "@/lib/allCountyMeals.mjs";
import { STAFF_FIELDS, TABLE } from "@/lib/allCountyMealsServer";

export const runtime = "nodejs";
const ROUTE = "/api/admin/all-county-meals";

// Staff view of All-County meal orders (#221): meal counts for ordering, orders by school with
// student names, payment marking, and CSV. Student names are minors from other schools.
export async function GET(request) {
  const auth = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ALLCOUNTY_MEALS_READ);
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const { data, error } = await supabaseAdmin.from(TABLE).select(STAFF_FIELDS).eq("event_key", EVENT_KEY);
  if (error) return privateJson({ error: "Meal orders could not be loaded. Please try again." }, 503);
  const summary = staffSummary(data);
  const csv = new URL(request.url).searchParams.get("format") === "csv";
  await logAudit({ actor: staffActor(auth.staff), action: csv ? "allcounty_meals.export" : "allcounty_meals.view", table: TABLE, recordId: EVENT_KEY, changes: { schools: summary.totals.schools, students: summary.totals.students }, route: ROUTE });
  if (csv) {
    return new Response(summaryCsv(summary), { headers: { ...PRIVATE_RESPONSE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="all-county-meals-2026.csv"' } });
  }
  return privateJson({ ...summary, meals: MEALS, priceCents: MEAL_PRICE_CENTS, deadline: SIGNUP_DEADLINE });
}

// Record or clear a school's payment. paid_cents null clears it.
export async function POST(request) {
  const auth = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ALLCOUNTY_MEALS_WRITE);
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const clear = body?.paid_cents === null;
  const paidCents = clear ? null : Number(body?.paid_cents);
  const method = clear ? null : body?.paid_method;
  if (!id || (!clear && (!Number.isInteger(paidCents) || paidCents < 0 || paidCents > 10_000_00)) || (!clear && !["check", "cash", "mixed"].includes(method))) {
    return privateJson({ error: "Enter the amount received and how it was paid." }, 400);
  }
  const patch = clear
    ? { paid_cents: null, paid_method: null, paid_recorded_at: null, paid_recorded_by: null }
    : { paid_cents: paidCents, paid_method: method, paid_recorded_at: new Date().toISOString(), paid_recorded_by: auth.staff?.display_name || String(auth.staff?.id || "staff") };
  const { data, error } = await supabaseAdmin.from(TABLE).update(patch).eq("id", id).eq("event_key", EVENT_KEY).select("id").maybeSingle();
  if (error) return privateJson({ error: "The payment could not be saved. Please try again." }, 503);
  if (!data) return privateJson({ error: "That order was not found." }, 404);
  await logAudit({ actor: staffActor(auth.staff), action: clear ? "allcounty_meals.payment_cleared" : "allcounty_meals.payment_recorded", table: TABLE, recordId: id, changes: { paid_cents: paidCents, paid_method: method }, route: ROUTE });
  return privateJson({ ok: true });
}
