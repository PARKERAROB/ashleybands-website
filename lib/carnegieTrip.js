import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInvoiceId, isTrustedGuardian, trustedStudentIds } from "@/lib/billing";
import { createOrder, getOrder } from "@/lib/paypal";
import {
  CARNEGIE_AGREEMENT_VERSION,
  CARNEGIE_AMOUNT_BANDS,
  CARNEGIE_DEPOSIT_CATEGORY,
  CARNEGIE_DEPOSIT_CENTS,
  CARNEGIE_HELP_OPTIONS,
  CARNEGIE_RESPONSE_OPTIONS,
} from "@/lib/carnegieTripConstants";

const CLOSED_CONTACT_STATUSES = new Set(["hard_bounce", "replaced", "superseded"]);
const ELIGIBLE_ENSEMBLES = ["Concert Band", "Wind Ensemble", "Percussion Ensemble"];

function chunks(values, size = 40) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function value(input, max = 1000) {
  return String(input || "").trim().slice(0, max);
}

function normalizedEmail(input) {
  return value(input, 320).toLowerCase();
}

function normalizedName(input) {
  return value(input, 200)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function isEligibleEnsemble(ensemble) {
  const text = String(ensemble || "").toLowerCase();
  return ELIGIBLE_ENSEMBLES.some((name) => text.includes(name.toLowerCase()));
}

function checkoutSecret() {
  const secret = process.env.CARNEGIE_CHECKOUT_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("Carnegie checkout signing is not configured.");
  return secret;
}

export function createCarnegieCheckoutToken({ submissionId, studentId, email = "" }) {
  const payload = {
    submissionId,
    studentId,
    email: normalizedEmail(email),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 48,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", checkoutSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readCarnegieCheckoutToken(token) {
  try {
    const [encoded, signature] = String(token || "").split(".");
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac("sha256", checkoutSecret()).update(encoded).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.submissionId || !payload.studentId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function validateCarnegieSubmission(input, { staffVerbal = false } = {}) {
  const response = value(input.response, 40);
  const allowedResponses = new Set(CARNEGIE_RESPONSE_OPTIONS.map((option) => option.value));
  const allowedBands = new Set(CARNEGIE_AMOUNT_BANDS.map((option) => option.value));
  const allowedHelp = new Set(CARNEGIE_HELP_OPTIONS.map((option) => option.value));
  if (!allowedResponses.has(response)) return { error: "Choose one trip response." };
  const maximumFamilyAmountBand = value(input.maximumFamilyAmountBand, 40);
  if (response === "interested_limited" && !allowedBands.has(maximumFamilyAmountBand)) {
    return { error: "Choose the highest family amount you can responsibly plan for." };
  }
  const helpOptions = [...new Set((Array.isArray(input.helpOptions) ? input.helpOptions : [])
    .map((option) => value(option, 50)).filter((option) => allowedHelp.has(option)))];
  const guardianName = value(input.guardianName, 200);
  const guardianEmail = normalizedEmail(input.guardianEmail);
  const guardianPhone = value(input.guardianPhone, 80);
  const guardianSignature = value(input.guardianSignature, 200);
  const studentSignature = value(input.studentSignature, 200);
  const termsAccepted = input.termsAccepted === true;
  if (!guardianName) return { error: "Enter the parent or guardian name." };
  if (!staffVerbal && (!guardianEmail || !guardianEmail.includes("@"))) return { error: "Enter a valid guardian email." };
  if (!staffVerbal && (!guardianSignature || !studentSignature || !termsAccepted)) {
    return { error: "Complete both signatures and accept the acknowledgement." };
  }
  return {
    response,
    maximumFamilyAmountBand: response === "interested_limited" ? maximumFamilyAmountBand : "",
    helpOptions,
    guardianName,
    guardianEmail,
    guardianPhone,
    guardianSignature: staffVerbal ? "" : guardianSignature,
    studentSignature: staffVerbal ? "" : studentSignature,
    termsAccepted: staffVerbal ? false : termsAccepted,
    note: value(input.note, 1000),
  };
}

export async function findCarnegieStudentFromPublicIdentity({ firstName, lastName, schoolEmail }) {
  const email = normalizedEmail(schoolEmail);
  if (!email || !email.endsWith("@student.nhcs.net")) return null;
  const { data, error } = await supabaseAdmin.from("portal_students")
    .select("id,display_name,legal_first,legal_last,preferred_first,school_email,ensemble_2026,status")
    .eq("school_email", email)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data || !isEligibleEnsemble(data.ensemble_2026)) return null;
  const first = normalizedName(firstName);
  const last = normalizedName(lastName);
  const firstMatches = [data.legal_first, data.preferred_first].some((candidate) => normalizedName(candidate) === first);
  if (!firstMatches || normalizedName(data.legal_last) !== last) return null;
  return data;
}

export async function loadPortalCarnegieStudents(personId) {
  const ids = await trustedStudentIds(personId);
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin.from("portal_students")
    .select("id,display_name,legal_first,legal_last,preferred_first,school_email,ensemble_2026,status")
    .in("id", ids).eq("status", "active");
  if (error) throw new Error(error.message);
  return (data || []).filter((student) => isEligibleEnsemble(student.ensemble_2026));
}

export async function recordCarnegieSubmission({
  studentId,
  source,
  fields,
  submissionKey,
  personId = null,
  staffId = null,
  actor,
  request,
  route,
}) {
  const { data, error } = await supabaseAdmin.rpc("record_carnegie_trip_submission", {
    p_student_id: studentId,
    p_source: source,
    p_response: fields.response,
    p_maximum_family_amount_band: fields.maximumFamilyAmountBand,
    p_help_options: fields.helpOptions,
    p_guardian_name: fields.guardianName,
    p_guardian_email: fields.guardianEmail,
    p_guardian_phone: fields.guardianPhone,
    p_guardian_signature: fields.guardianSignature,
    p_student_signature: fields.studentSignature,
    p_agreement_version: CARNEGIE_AGREEMENT_VERSION,
    p_terms_accepted: fields.termsAccepted,
    p_submission_key: value(submissionKey, 200),
    p_note: fields.note,
    p_submitted_by_person_id: personId,
    p_submitted_by_staff_id: staffId,
    p_actor_type: actor?.type || "system",
    p_actor_id: actor?.id ? String(actor.id) : "",
    p_actor_name: actor?.name || "",
    p_ip_created: request?.headers?.get("x-forwarded-for") || "",
    p_user_agent_created: request?.headers?.get("user-agent") || "",
    p_route: route,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function completedCarnegiePayment(studentId) {
  const { data, error } = await supabaseAdmin.from("fee_payments")
    .select("id,amount_cents,status,invoice_id,paypal_order_id,paypal_capture_id,received_at,method,category")
    .eq("student_id", studentId)
    .eq("category", CARNEGIE_DEPOSIT_CATEGORY)
    .eq("kind", "fee")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function carnegieSubmissionStatus(submission) {
  if (!submission) return null;
  const payment = await completedCarnegiePayment(submission.student_id);
  return {
    submissionId: submission.id,
    response: submission.response,
    source: submission.source,
    maximumFamilyAmountBand: submission.maximum_family_amount_band,
    createdAt: submission.created_at,
    signed: Boolean(submission.signed_at),
    paid: Boolean(payment),
    payment,
    checkoutToken: submission.response === "serious_yes" && !payment
      ? createCarnegieCheckoutToken({ submissionId: submission.id, studentId: submission.student_id, email: submission.guardian_email })
      : "",
  };
}

export async function latestCarnegieSubmissions(studentIds) {
  if (!studentIds.length) return {};
  const results = await Promise.all(chunks(studentIds).map((part) => supabaseAdmin.from("carnegie_trip_submissions")
    .select("id,student_id,source,response,maximum_family_amount_band,help_options,guardian_name,guardian_email,guardian_phone,guardian_signature,student_signature,agreement_version,terms_accepted,signed_at,note,created_at,submitted_by_staff_id")
    .in("student_id", part)
    .order("created_at", { ascending: false })));
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(failed.error.message);
  const latest = {};
  for (const row of results.flatMap((result) => result.data || [])) if (!latest[row.student_id]) latest[row.student_id] = row;
  return latest;
}

export async function createCarnegiePaymentOrder(token) {
  const payload = readCarnegieCheckoutToken(token);
  if (!payload) throw new Error("This payment link is invalid or expired.");
  const { data: submission, error: submissionError } = await supabaseAdmin.from("carnegie_trip_submissions")
    .select("id,student_id,response,guardian_email")
    .eq("id", payload.submissionId).eq("student_id", payload.studentId).maybeSingle();
  if (submissionError || !submission || submission.response !== "serious_yes") throw new Error("A serious trip commitment is required before payment.");
  if (await completedCarnegiePayment(payload.studentId)) throw new Error("This conditional deposit is already paid.");
  const { data: charge, error: chargeError } = await supabaseAdmin.from("fee_charges")
    .select("id,amount_cents,status")
    .eq("student_id", payload.studentId).eq("category", CARNEGIE_DEPOSIT_CATEGORY).eq("status", "active").maybeSingle();
  if (chargeError || !charge || Number(charge.amount_cents) !== CARNEGIE_DEPOSIT_CENTS) throw new Error("The connected conditional-deposit charge is unavailable.");

  const { data: existing } = await supabaseAdmin.from("fee_payments")
    .select("id,invoice_id,paypal_order_id,status")
    .eq("student_id", payload.studentId).eq("category", CARNEGIE_DEPOSIT_CATEGORY)
    .eq("kind", "fee").eq("status", "pending").not("paypal_order_id", "eq", "")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.paypal_order_id) {
    let order;
    try {
      order = await getOrder(existing.paypal_order_id);
    } catch {
      throw new Error("An existing payment session could not be verified. Wait a moment and try again.");
    }
    const orderStatus = String(order?.status || "");
    if (["CREATED", "APPROVED", "PAYER_ACTION_REQUIRED"].includes(orderStatus)) {
      return { orderId: existing.paypal_order_id, paymentId: existing.id };
    }
    if (orderStatus === "COMPLETED") {
      throw new Error("PayPal completed this deposit and AshleyBands is reconciling it. Refresh before trying again.");
    }
    if (orderStatus !== "VOIDED") {
      throw new Error("The existing PayPal session needs review before another payment can begin.");
    }
    await supabaseAdmin.from("fee_payments").update({ status: "failed", notes: "Replaced stale PayPal order before capture." }).eq("id", existing.id);
  }

  const invoiceId = generateInvoiceId();
  const { data: payment, error: insertError } = await supabaseAdmin.from("fee_payments").insert({
    student_id: payload.studentId,
    amount_cents: CARNEGIE_DEPOSIT_CENTS,
    method: "paypal",
    status: "pending",
    category: CARNEGIE_DEPOSIT_CATEGORY,
    kind: "fee",
    invoice_id: invoiceId,
    recorded_by: "family_online",
    payer_name: "",
    notes: `Carnegie initial intent ${submission.id}`,
  }).select("id").single();
  if (insertError) throw new Error("Could not start the connected payment.");

  try {
    const order = await createOrder({
      amountCents: CARNEGIE_DEPOSIT_CENTS,
      studentId: payload.studentId,
      invoiceId,
      description: "Ashley Bands Carnegie Hall conditional deposit",
      requestId: invoiceId,
    });
    const { error: updateError } = await supabaseAdmin.from("fee_payments")
      .update({ paypal_order_id: order.id }).eq("id", payment.id);
    if (updateError) throw new Error(updateError.message);
    return { orderId: order.id, paymentId: payment.id };
  } catch (error) {
    await supabaseAdmin.from("fee_payments").update({ status: "failed", notes: value(error.message, 500) }).eq("id", payment.id);
    throw error;
  }
}

export async function isPortalGuardianForStudent(personId, studentId) {
  return isTrustedGuardian(personId, studentId);
}

async function loadGuardianContacts(studentIds) {
  const links = [];
  for (const part of chunks(studentIds)) {
    const { data, error } = await supabaseAdmin.from("portal_student_people")
      .select("student_id,primary_contact,portal_people(id,display_name,person_type)")
      .in("student_id", part).eq("relationship_status", "trusted");
    if (error) throw new Error(error.message);
    links.push(...(data || []));
  }
  const guardianLinks = links.filter((link) => link.portal_people?.person_type === "guardian");
  const personIds = [...new Set(guardianLinks.map((link) => link.portal_people.id))];
  const contacts = [];
  for (const part of chunks(personIds)) {
    const { data, error } = await supabaseAdmin.from("portal_contact_methods")
      .select("person_id,contact_type,value_display,verification_status")
      .in("person_id", part);
    if (error) throw new Error(error.message);
    contacts.push(...(data || []));
  }
  const byPerson = {};
  for (const contact of contacts) {
    if (CLOSED_CONTACT_STATUSES.has(contact.verification_status)) continue;
    (byPerson[contact.person_id] ||= []).push(contact);
  }
  const result = {};
  for (const link of guardianLinks.sort((a, b) => Number(b.primary_contact) - Number(a.primary_contact))) {
    if (result[link.student_id]) continue;
    const personContacts = byPerson[link.portal_people.id] || [];
    result[link.student_id] = {
      name: link.portal_people.display_name,
      email: personContacts.find((contact) => contact.contact_type === "email")?.value_display || "",
      phone: personContacts.find((contact) => contact.contact_type === "phone")?.value_display || "",
    };
  }
  return result;
}

export async function loadCarnegieDashboard() {
  const { data: allStudents, error: studentError } = await supabaseAdmin.from("portal_students")
    .select("id,display_name,legal_first,legal_last,preferred_first,grade_fall26,school_email,ensemble_2026,status")
    .eq("status", "active").order("legal_last", { ascending: true }).order("legal_first", { ascending: true }).limit(500);
  if (studentError) throw new Error(studentError.message);
  const students = (allStudents || []).filter((student) => isEligibleEnsemble(student.ensemble_2026));
  const studentIds = students.map((student) => student.id);
  const [latest, guardianContacts, trackingResult, chargeResult, paymentResult] = await Promise.all([
    latestCarnegieSubmissions(studentIds),
    loadGuardianContacts(studentIds),
    supabaseAdmin.from("carnegie_trip_staff_tracking").select("student_id,eligibility_status,follow_up_status,staff_note,updated_at").in("student_id", studentIds),
    supabaseAdmin.from("fee_charges").select("id,student_id,amount_cents,status,category,created_at").in("student_id", studentIds).eq("category", CARNEGIE_DEPOSIT_CATEGORY),
    supabaseAdmin.from("fee_payments").select("id,student_id,amount_cents,method,status,category,invoice_id,paypal_capture_id,received_at,created_at,payer_name,check_number").in("student_id", studentIds).eq("category", CARNEGIE_DEPOSIT_CATEGORY),
  ]);
  for (const result of [trackingResult, chargeResult, paymentResult]) if (result.error) throw new Error(result.error.message);
  const tracking = Object.fromEntries((trackingResult.data || []).map((row) => [row.student_id, row]));
  const charges = {};
  for (const row of chargeResult.data || []) (charges[row.student_id] ||= []).push(row);
  const payments = {};
  for (const row of paymentResult.data || []) (payments[row.student_id] ||= []).push(row);
  const rows = students.map((student) => {
    const submission = latest[student.id] || null;
    const studentPayments = payments[student.id] || [];
    const completed = studentPayments.find((payment) => payment.status === "completed") || null;
    const refunded = studentPayments.find((payment) => payment.status === "refunded") || null;
    const activeCharge = (charges[student.id] || []).find((charge) => charge.status === "active") || null;
    const contact = submission ? {
      name: submission.guardian_name,
      email: submission.guardian_email,
      phone: submission.guardian_phone,
    } : guardianContacts[student.id] || { name: "", email: "", phone: "" };
    return {
      student,
      submission,
      contact,
      tracking: tracking[student.id] || {
        eligibility_status: /wind ensemble/i.test(student.ensemble_2026 || "") ? "preapproved" : "needs_review",
        follow_up_status: "none",
        staff_note: "",
      },
      charge: activeCharge,
      payments: studentPayments,
      depositStatus: completed ? "received" : refunded ? "refunded" : activeCharge ? "payment_pending" : "not_requested",
      completedPayment: completed,
    };
  });
  return {
    rows,
    updatedAt: [
      ...rows.map((row) => row.submission?.created_at),
      ...rows.map((row) => row.completedPayment?.received_at || row.completedPayment?.created_at),
    ].filter(Boolean).sort().at(-1) || null,
  };
}
