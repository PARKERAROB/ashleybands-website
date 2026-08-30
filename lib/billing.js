import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Confirm a logged-in guardian is a TRUSTED contact for a student before any
// billing action. Mirrors the trusted-link check in app/api/portal/me/route.js.
export async function isTrustedGuardian(personId, studentId) {
  if (!personId || !studentId) return false;
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("id,portal_people!inner(person_type),portal_students!inner(status)")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .in("assurance_level", ["medium", "high"])
    .eq("portal_people.person_type", "guardian")
    .eq("portal_students.status", "active")
    .maybeSingle();
  return Boolean(data);
}

// All student ids a person is a trusted guardian for.
export async function trustedStudentIds(personId) {
  if (!personId) return [];
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("student_id,assurance_level,portal_people!inner(person_type),portal_students!inner(status)")
    .eq("person_id", personId)
    .eq("relationship_status", "trusted")
    .eq("portal_students.status", "active");
  return [...new Set((data || []).filter((row) => {
    const person = Array.isArray(row.portal_people) ? row.portal_people[0] : row.portal_people;
    if (person?.person_type === "student") return row.assurance_level === "high";
    return person?.person_type === "guardian" && ["medium", "high"].includes(row.assurance_level);
  }).map((row) => row.student_id).filter(Boolean))];
}

export function generateInvoiceId() {
  return `AB-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`.toUpperCase();
}

// Spring-Trip forgo-to-MB feature flag. DARK by default: the family UI and the
// forgo-refund endpoint stay invisible/closed until FORGO_REFUND_LIVE === "true"
// is set (go-live is timed WITH Rob's parent email, not before).
export function forgoRefundLive() {
  return String(process.env.FORGO_REFUND_LIVE || "").toLowerCase() === "true";
}

// Pull each student's spring-trip refund-credit row (one per student, or none).
// Keyed by student_id for easy attach in /api/billing/me.
export async function loadRefundCredits(studentIds) {
  const ids = (studentIds || []).filter(Boolean);
  if (!ids.length) return {};
  const { data } = await supabaseAdmin
    .from("spring_trip_refund_credits")
    .select("student_id, confirmed_cents, topup_cents, full_cents, status, applied_at")
    .in("student_id", ids);
  return (data || []).reduce((acc, row) => {
    acc[row.student_id] = row;
    return acc;
  }, {});
}

// A charge/payment category is either a collective funding goal (marching band
// season — raised together, not a personal bill) or a real fee (spring trip, etc.).
// Drives fallback language for older rows. New charges and payments both persist
// an explicit kind so a category typo cannot move money between ledgers.
export function chargeKindForCategory(category) {
  return String(category || "").startsWith("marching_band") ? "funding_goal" : "fee";
}

// Pull charges + payments + balance for a set of student ids.
export async function loadStudentLedgers(studentIds) {
  const ids = (studentIds || []).filter(Boolean);
  if (!ids.length) return { charges: {}, payments: {}, balances: {} };

  const [{ data: charges }, { data: payments }, { data: balances }] = await Promise.all([
    supabaseAdmin
      .from("fee_charges")
      .select("id, student_id, category, label, amount_cents, status, kind, created_at")
      .in("student_id", ids)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("fee_payments")
      .select("id, student_id, amount_cents, method, status, category, kind, received_at, payer_name, check_number, is_sponsorship, notes, created_at")
      .in("student_id", ids)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("student_program_fee_summary")
      .select("student_id, charged_cents, paid_cents, balance_cents")
      .in("student_id", ids)
  ]);

  const group = (rows, key) =>
    (rows || []).reduce((acc, row) => {
      (acc[row[key]] = acc[row[key]] || []).push(row);
      return acc;
    }, {});

  const balanceByStudent = (balances || []).reduce((acc, row) => {
    acc[row.student_id] = row;
    return acc;
  }, {});

  return {
    charges: group(charges, "student_id"),
    payments: group(payments, "student_id"),
    balances: balanceByStudent
  };
}
