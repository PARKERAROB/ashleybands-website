import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Public Spring-Trip 2026 refund-choice form. CAPTURE-ONLY: records the family's
// stated choice as one row in spring_trip_refund_submissions; it moves NO money.
// The treasurer processes each row (cut a check / apply the MB credit / log the
// donation). An unauthenticated public form must never write to funding goals.
//
// DARK until go-live: set NEXT_PUBLIC_SPRING_TRIP_REFUND_OPEN=true on Vercel +
// redeploy, timed WITH the parent email. Flag off => 403 (matches the page's
// closed state, so a stray request can't write while the form reads as closed).

function formOpen() {
  return String(process.env.NEXT_PUBLIC_SPRING_TRIP_REFUND_OPEN || "").toLowerCase() === "true";
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  if (!formOpen()) {
    return NextResponse.json({ error: "This form is not open yet." }, { status: 403 });
  }

  // Public endpoint -> rate-limit by IP (the limiter fails open, so it can never
  // lock out a legitimate family).
  const ip = clientIp(request);
  const { allowed } = await checkRateLimit({
    key: `spring-trip-refund:${ip}`,
    limit: 8,
    windowMs: 10 * 60 * 1000
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again in a little while." },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const submission = {
    student_first_name: clean(body.student_first_name, 120),
    student_last_name: clean(body.student_last_name, 120),
    guardian_name: clean(body.guardian_name, 200),
    guardian_email: clean(body.guardian_email, 200),
    guardian_phone: clean(body.guardian_phone, 50),
    amount_paid: clean(body.amount_paid, 50),
    refund_choice: clean(body.refund_choice, 40),
    check_payable_to: clean(body.check_payable_to, 200) || null,
    check_delivery: clean(body.check_delivery, 20) || null,
    mailing_address: clean(body.mailing_address, 1000) || null,
    hardship_full_refund: Boolean(body.hardship_full_refund),
    deduction_acknowledgment: Boolean(body.deduction_acknowledgment),
    notes: clean(body.notes, 2000) || null,
    parent_signature: clean(body.parent_signature, 200)
  };

  // Required identity + choice fields.
  const required = [
    "student_first_name",
    "student_last_name",
    "guardian_name",
    "guardian_email",
    "guardian_phone",
    "amount_paid",
    "refund_choice",
    "parent_signature"
  ];
  if (required.some((field) => !submission[field])) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!isEmail(submission.guardian_email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!["apply_mb_2026", "refund", "donate"].includes(submission.refund_choice)) {
    return NextResponse.json({ error: "Please choose a refund option." }, { status: 400 });
  }

  // A refund check needs a payable-to name + delivery method, and a mailing address
  // if it is to be mailed. Non-refund choices keep no check details.
  if (submission.refund_choice === "refund") {
    if (!submission.check_payable_to || !submission.check_delivery) {
      return NextResponse.json(
        { error: "For a refund check, tell us who to make it out to and pickup vs. mail." },
        { status: 400 }
      );
    }
    if (!["pickup", "mail"].includes(submission.check_delivery)) {
      return NextResponse.json({ error: "Please choose pickup or mail." }, { status: 400 });
    }
    if (submission.check_delivery === "mail" && !submission.mailing_address) {
      return NextResponse.json(
        { error: "Please include a mailing address for a mailed check." },
        { status: 400 }
      );
    }
  } else {
    submission.check_payable_to = null;
    submission.check_delivery = null;
    submission.mailing_address = null;
  }

  const { error } = await supabaseAdmin
    .from("spring_trip_refund_submissions")
    .insert(submission);

  if (error) {
    return NextResponse.json({ error: "The form did not submit. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
