// All-County meals (#221): validation, invoice math, staff counts, CSV and privacy boundaries.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MEALS, MEAL_PRICE_CENTS, buildInvoice, cleanSignup, invoiceEmail, invoiceMeals, paymentStatus, signupsOpen, staffSummary, summaryCsv, SIGNUP_DEADLINE,
} from "../lib/allCountyMeals.mjs";

const ALL_ON = MEALS.map((meal) => ({ ...meal, offered: true }));
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const body = {
  director_name: " Example  Director ", school: "Example Middle School", director_email: "Director@Example.org",
  students: [
    { name: "Student Two", meals: ["mon_lunch", "tue_lunch", "tue_dinner"] },
    { name: "Student One", meals: ["tue_lunch"] },
    { name: "", meals: [] },
  ],
};

test("a director's form is trimmed, lowercased, sorted and closed to bad input", () => {
  const { value } = cleanSignup(body, { meals: ALL_ON });
  assert.equal(value.director_name, "Example Director");
  assert.equal(value.director_email, "director@example.org");
  assert.deepEqual(value.students.map((s) => s.name), ["Student One", "Student Two"]);
  assert.deepEqual(Object.keys(value).sort(), ["director_email", "director_name", "school", "students"]);
  assert.deepEqual(Object.keys(value.students[0]).sort(), ["meals", "name"]);
  assert.ok(cleanSignup({ ...body, director_email: "not-an-email" }).error);
  assert.ok(cleanSignup({ ...body, school: "" }).error);
  assert.ok(cleanSignup({ ...body, students: [] }).error, "new order needs a student");
  assert.equal(cleanSignup({ ...body, students: [] }, { minStudents: 0 }).value.students.length, 0, "an edit may cancel everything");
  assert.match(cleanSignup({ ...body, students: [{ name: "A", meals: [] }] }).error, /at least one meal/);
  assert.match(cleanSignup({ ...body, students: [{ name: "A", meals: ["brunch"] }] }).error, /not available/);
  assert.match(cleanSignup({ ...body, students: [{ name: "Ann", meals: ["mon_lunch"] }, { name: "ann ", meals: ["tue_lunch"] }] }).error, /twice/);
  assert.ok(cleanSignup({ ...body, students: Array.from({ length: 201 }, (_, i) => ({ name: `S${i}`, meals: ["mon_lunch"] })) }).error);
  assert.ok(cleanSignup([]).error);
});

test("lunches only: dinner is turned off, so new orders cannot pick it", () => {
  assert.deepEqual(MEALS.filter((meal) => meal.offered).map((meal) => meal.key), ["mon_lunch", "tue_lunch"]);
  assert.match(cleanSignup(body).error, /not available/);
  const noDinner = MEALS;
  assert.match(cleanSignup(body, { meals: noDinner }).error, /not available/);
  const ok = cleanSignup({ ...body, students: [{ name: "A", meals: ["mon_lunch"] }] }, { meals: noDinner });
  assert.deepEqual(ok.value.students[0].meals, ["mon_lunch"]);
  const invoice = buildInvoice([{ name: "A", meals: ["mon_lunch"] }], 800, noDinner);
  assert.deepEqual(invoiceMeals(invoice, noDinner).map((m) => m.key), ["mon_lunch", "tue_lunch"]);
});

test("invoice total equals meals times price, with a count per meal", () => {
  const { value } = cleanSignup(body, { meals: ALL_ON });
  const invoice = buildInvoice(value.students, 800);
  assert.deepEqual(invoice.counts, { mon_lunch: 1, tue_lunch: 2, tue_dinner: 1 });
  assert.equal(invoice.totalMeals, 4);
  assert.equal(invoice.totalCents, 3200);
  assert.deepEqual(invoice.lines.map((l) => l.amountCents), [800, 2400]);
});

test("the price constant drives new invoices", () => {
  assert.equal(MEAL_PRICE_CENTS, 800);
  const { value } = cleanSignup(body, { meals: ALL_ON });
  assert.equal(buildInvoice(value.students).totalCents, 4 * MEAL_PRICE_CENTS);
  assert.equal(buildInvoice(value.students, 950).totalCents, 3800);
  const api = read("app/api/all-county/meals/route.js");
  assert.match(api, /price_cents: MEAL_PRICE_CENTS/);
  assert.doesNotMatch(api, /price_cents: (body|value)\./, "price never comes from the browser");
});

test("deadline closes orders", () => {
  assert.equal(signupsOpen(new Date("2026-11-01T12:00:00-05:00")), true);
  assert.equal(signupsOpen(new Date(Date.parse(SIGNUP_DEADLINE) + 1000)), false);
});

test("staff counts add up across schools and use each order's saved price", () => {
  const rows = [
    { id: "b", school: "B School", director_name: "D2", director_email: "b@x.org", students: [{ name: "X", meals: ["mon_lunch", "tue_lunch"] }], price_cents: 800, paid_cents: 1600, paid_method: "check", updated_at: "2026-10-21" },
    { id: "a", school: "A School", director_name: "D1", director_email: "a@x.org", students: [{ name: "Y", meals: ["tue_dinner"] }, { name: "Z", meals: ["mon_lunch"] }], price_cents: 900, paid_cents: null, updated_at: "2026-10-21" },
  ];
  const summary = staffSummary(rows);
  assert.deepEqual(summary.mealTotals, { mon_lunch: 2, tue_lunch: 1, tue_dinner: 1 });
  assert.deepEqual(summary.schools.map((s) => s.school), ["A School", "B School"]);
  assert.equal(summary.totals.invoicedCents, 1800 + 1600);
  assert.equal(summary.totals.paidCents, 1600);
  assert.equal(summary.schools[1].payment.status, "paid");
  assert.equal(summary.schools[0].payment.status, "invoiced");
  const csv = summaryCsv(summary);
  assert.equal(csv.trim().split("\r\n").length, 4);
  assert.match(csv, /^School,Director,Director email,Student,Mon 11\/23 lunch/);
  assert.match(csv, /A School,D1,a@x.org,Y,,,Yes,1,9.00,Invoiced/, "a turned-off meal still exports when it was ordered");
  const lunchOnly = summaryCsv(staffSummary([rows[0]]));
  assert.doesNotMatch(lunchOnly, /dinner/, "no dinner column when nobody ordered it");
});

test("payment status shows what is still owed", () => {
  assert.equal(paymentStatus(1600, null).label, "Invoiced");
  assert.equal(paymentStatus(1600, 800).label, "Owes $8");
  assert.equal(paymentStatus(1600, 2400).status, "overpaid");
});

test("CSV cells cannot run as spreadsheet formulas", () => {
  const summary = staffSummary([{ id: "c", school: "=HYPERLINK(1)", director_name: "D", director_email: "d@x.org", students: [{ name: "+Evil, \"Q\"", meals: ["mon_lunch"] }], price_cents: 800, paid_cents: null, updated_at: "2026-10-21" }]);
  const csv = summaryCsv(summary);
  assert.match(csv, /'=HYPERLINK\(1\)/);
  assert.match(csv, /"'\+Evil, ""Q"""/);
});

test("invoice email states total, payment route and edit link, and escapes names", () => {
  const signup = { director_name: "D <b>", school: "S", director_email: "d@x.org" };
  const invoice = buildInvoice([{ name: "<script>", meals: ["mon_lunch"] }], 800);
  const message = invoiceEmail({ signup, invoice, editUrl: "https://ashleybands.com/all-county/meals?edit=abc" });
  assert.match(message.text, /Total: 1 meal x \$8 = \$8/);
  assert.match(message.text, /check or cash/);
  assert.match(message.text, /edit=abc/);
  assert.doesNotMatch(message.html, /<script>|<b>/);
});

test("storage and routes keep student names private", () => {
  const migration = read("supabase/migrations/202610210001_allcounty_meal_signups.sql");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all privileges on table public\.allcounty_meal_signups from anon, authenticated/);
  assert.match(migration, /source text not null default 'director_form'/);
  assert.doesNotMatch(migration, /^\s+\w*(phone|student_email|birth|address)\w* /m, "no student contact columns");
  const admin = read("app/api/admin/all-county-meals/route.js");
  assert.equal((admin.match(/authorizeStaffRequest\(/g) || []).length, 2);
  assert.equal((admin.match(/logAudit\(/g) || []).length, 2);
  const api = read("app/api/all-county/meals/route.js");
  assert.match(api, /failOpen: false/);
  assert.doesNotMatch(read("lib/allCountyMealsServer.js").match(/DIRECTOR_FIELDS = "([^"]+)"/)[1], /edit_token_hash|paid_/);
  assert.match(read("app/all-county/meals/page.jsx"), /index: false/);
});
