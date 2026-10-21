// All-County Honor Band clinic meals (#221). NHCS band directors order pre-boxed meals for their
// students. The AHS Band Boosters order to exact numbers, and each director collects from their own
// students and pays the boosters by check or cash. Nothing is charged online.
//
// Change the price, the meals or the deadline here. A saved invoice keeps the price it was saved
// at; the next time the director saves, it is repriced at the current MEAL_PRICE_CENTS.

export const EVENT_KEY = "allcounty-2026";

// $8 per meal. Waiting on the Band Boosters to confirm (asked 2026-10-21).
export const MEAL_PRICE_CENTS = 800;

// Sign-ups and edits close at this moment (Eastern time).
export const SIGNUP_DEADLINE = "2026-11-13T23:59:59-05:00";
export const SIGNUP_DEADLINE_LABEL = "Friday, November 13";

// Set offered: false to stop taking orders for a meal. Saved orders still count until edited.
export const MEALS = Object.freeze([
  { key: "mon_lunch", label: "Mon 11/23 lunch", detail: "Monday, November 23, lunch at 11:30", offered: true },
  { key: "tue_lunch", label: "Tue 11/24 lunch", detail: "Tuesday, November 24, lunch at 12:30", offered: true },
  { key: "tue_dinner", label: "Tue 11/24 dinner", detail: "Tuesday, November 24, dinner before the 6:00 concert", offered: true },
]);

export const MEAL_PAYEE = "Ashley High School Band Boosters";
export const MAX_STUDENTS = 200;
const LIMITS = { director_name: 120, school: 120, director_email: 254, student: 100 };

// Suggestions only; a director can type any school.
export const SCHOOL_SUGGESTIONS = Object.freeze([
  "Ashley High School", "Hoggard High School", "Laney High School", "New Hanover High School",
  "Holly Shelter Middle School", "Murray Middle School", "Myrtle Grove Middle School", "Noble Middle School",
  "Roland-Grise Middle School", "Trask Middle School", "Williston Middle School",
]);

export function offeredMeals(meals = MEALS) {
  return meals.filter((meal) => meal.offered);
}

export function signupsOpen(now = new Date(), deadline = SIGNUP_DEADLINE) {
  return now.getTime() <= Date.parse(deadline);
}

export function formatCents(cents) {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(value) ? 0 : 2 });
}

const text = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validates a director's form. Returns { value } or { error } with words a director can act on.
// minStudents is 1 for a new sign-up and 0 for an edit, so a director can cancel every order.
export function cleanSignup(body, { meals = MEALS, minStudents = 1 } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid request." };
  const director_name = text(body.director_name);
  const school = text(body.school);
  const director_email = text(body.director_email).toLowerCase();
  if (!director_name || !school || !director_email) return { error: "Please enter your name, school and email." };
  if (director_name.length > LIMITS.director_name || school.length > LIMITS.school) return { error: "Your name or school is too long." };
  if (director_email.length > LIMITS.director_email || !EMAIL.test(director_email)) return { error: "Please enter a valid email address." };

  if (!Array.isArray(body.students)) return { error: "Please add your students." };
  const open = new Set(offeredMeals(meals).map((meal) => meal.key));
  const students = [];
  const seen = new Set();
  for (const entry of body.students) {
    if (!entry || typeof entry !== "object") return { error: "Invalid student entry." };
    const name = text(entry.name);
    if (!name && !(Array.isArray(entry.meals) && entry.meals.length)) continue; // blank row
    if (!name) return { error: "Every student with meals checked needs a name." };
    if (name.length > LIMITS.student) return { error: `${name.slice(0, 40)}… is too long for a name.` };
    if (!Array.isArray(entry.meals)) return { error: "Invalid meal choice." };
    const chosen = meals.map((meal) => meal.key).filter((key) => entry.meals.includes(key) && open.has(key));
    if (entry.meals.some((key) => typeof key !== "string" || !open.has(key))) return { error: "One of the meal choices is not available." };
    if (!chosen.length) return { error: `Pick at least one meal for ${name}, or remove the row.` };
    const folded = name.toLowerCase();
    if (seen.has(folded)) return { error: `${name} is listed twice.` };
    seen.add(folded);
    students.push({ name, meals: chosen });
  }
  if (students.length < minStudents) return { error: "Please add at least one student." };
  if (students.length > MAX_STUDENTS) return { error: `Please list ${MAX_STUDENTS} students or fewer.` };
  students.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return { value: { director_name, school, director_email, students } };
}

// One invoice: a line per student, a count per meal, and the total at priceCents.
export function buildInvoice(students, priceCents = MEAL_PRICE_CENTS, meals = MEALS) {
  const counts = Object.fromEntries(meals.map((meal) => [meal.key, 0]));
  const lines = (students || []).map((student) => {
    for (const key of student.meals) if (key in counts) counts[key] += 1;
    return { name: student.name, meals: student.meals, mealCount: student.meals.length, amountCents: student.meals.length * priceCents };
  });
  const totalMeals = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { lines, counts, totalMeals, priceCents, totalCents: totalMeals * priceCents };
}

// Meals that appear on this invoice: every offered meal, plus any turned-off meal still ordered.
export function invoiceMeals(invoice, meals = MEALS) {
  return meals.filter((meal) => meal.offered || invoice.counts[meal.key] > 0);
}

export function paymentStatus(totalCents, paidCents) {
  if (paidCents == null) return { status: "invoiced", label: "Invoiced", dueCents: totalCents };
  const due = totalCents - paidCents;
  if (due === 0) return { status: "paid", label: "Paid", dueCents: 0 };
  if (due > 0) return { status: "partial", label: `Owes ${formatCents(due)}`, dueCents: due };
  return { status: "overpaid", label: `Overpaid ${formatCents(-due)}`, dueCents: due };
}

// Staff view: meal totals for ordering, and one row per school sign-up.
export function staffSummary(signups, meals = MEALS) {
  const mealTotals = Object.fromEntries(meals.map((meal) => [meal.key, 0]));
  const schools = (signups || []).map((row) => {
    const invoice = buildInvoice(row.students, row.price_cents, meals);
    for (const [key, n] of Object.entries(invoice.counts)) mealTotals[key] += n;
    return {
      id: row.id,
      school: row.school,
      director: row.director_name,
      email: row.director_email,
      students: invoice.lines,
      counts: invoice.counts,
      totalMeals: invoice.totalMeals,
      priceCents: row.price_cents,
      totalCents: invoice.totalCents,
      paidCents: row.paid_cents ?? null,
      paidMethod: row.paid_method || null,
      payment: paymentStatus(invoice.totalCents, row.paid_cents ?? null),
      updatedAt: row.updated_at,
    };
  }).sort((a, b) => a.school.localeCompare(b.school, "en", { sensitivity: "base" }) || a.director.localeCompare(b.director));
  return {
    mealTotals,
    totals: {
      schools: schools.length,
      students: schools.reduce((sum, row) => sum + row.students.length, 0),
      meals: schools.reduce((sum, row) => sum + row.totalMeals, 0),
      invoicedCents: schools.reduce((sum, row) => sum + row.totalCents, 0),
      paidCents: schools.reduce((sum, row) => sum + (row.paidCents || 0), 0),
    },
    schools,
  };
}

function csvCell(value) {
  let cell = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`; // keep spreadsheet apps from running it as a formula
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

// One CSV row per student, for the boosters' order and for name labels.
export function summaryCsv(summary, meals = MEALS) {
  const header = ["School", "Director", "Director email", "Student", ...meals.map((meal) => meal.label), "Meals", "Amount", "School payment"];
  const rows = summary.schools.flatMap((school) => school.students.map((line) => [
    school.school, school.director, school.email, line.name,
    ...meals.map((meal) => (line.meals.includes(meal.key) ? "Yes" : "")),
    line.mealCount, (line.amountCents / 100).toFixed(2), school.payment.label,
  ]));
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// The invoice email. Plain text and HTML say the same thing.
export function invoiceEmail({ signup, invoice, editUrl, meals = MEALS }) {
  const shown = invoiceMeals(invoice, meals);
  const countLines = shown.map((meal) => `${meal.label}: ${invoice.counts[meal.key]}`);
  const subject = `All-County meals invoice: ${signup.school}`;
  const pay = `Collect from your students and give the Band Boosters one check or cash payment for ${signup.school}. Make checks payable to ${MEAL_PAYEE}, memo "All-County meals, ${signup.school}."`;
  const text = [
    `Thank you, ${signup.director_name}. Here is your All-County meals invoice for ${signup.school}.`,
    "",
    ...invoice.lines.map((line) => `- ${line.name}: ${line.meals.map((key) => meals.find((m) => m.key === key)?.label || key).join(", ")} (${formatCents(line.amountCents)})`),
    "",
    "Meal counts:", ...countLines.map((line) => `- ${line}`),
    "",
    `Total: ${invoice.totalMeals} ${invoice.totalMeals === 1 ? "meal" : "meals"} x ${formatCents(invoice.priceCents)} = ${formatCents(invoice.totalCents)}`,
    "",
    pay,
    "",
    `To add or remove students, use your private edit link: ${editUrl}`,
    `Changes close ${SIGNUP_DEADLINE_LABEL}. Questions? Reply to this email.`,
  ].join("\n");
  const cell = "padding:4px 10px;border-bottom:1px solid #ddd;text-align:left";
  const html = [
    `<p>Thank you, ${escapeHtml(signup.director_name)}. Here is your All-County meals invoice for <strong>${escapeHtml(signup.school)}</strong>.</p>`,
    `<table style="border-collapse:collapse"><thead><tr><th style="${cell}">Student</th>${shown.map((meal) => `<th style="${cell}">${escapeHtml(meal.label)}</th>`).join("")}<th style="${cell}">Amount</th></tr></thead><tbody>`,
    ...invoice.lines.map((line) => `<tr><td style="${cell}">${escapeHtml(line.name)}</td>${shown.map((meal) => `<td style="${cell}">${line.meals.includes(meal.key) ? "Yes" : ""}</td>`).join("")}<td style="${cell}">${formatCents(line.amountCents)}</td></tr>`),
    `<tr><th style="${cell}">Meal counts</th>${shown.map((meal) => `<th style="${cell}">${invoice.counts[meal.key]}</th>`).join("")}<th style="${cell}">${formatCents(invoice.totalCents)}</th></tr>`,
    "</tbody></table>",
    `<p><strong>Total: ${invoice.totalMeals} ${invoice.totalMeals === 1 ? "meal" : "meals"} x ${formatCents(invoice.priceCents)} = ${formatCents(invoice.totalCents)}</strong></p>`,
    `<p>${escapeHtml(pay)}</p>`,
    `<p><a href="${escapeHtml(editUrl)}">Add or remove students</a> with your private edit link. Changes close ${escapeHtml(SIGNUP_DEADLINE_LABEL)}.</p>`,
    "<p>Questions? Reply to this email.</p>",
  ].join("");
  return { subject, text, html };
}
