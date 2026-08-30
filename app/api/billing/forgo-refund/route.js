import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { isTrustedGuardian, forgoRefundLive } from "@/lib/billing";

export const runtime = "nodejs";

// Family chooses, ONCE, what to do with their cancelled Spring Trip 2026 refund:
//   choice 'forgo' -> forgo the refund check; credit confirmed_cents to the MB
//                     funding goal (writes one fee_payments row, method 'credit').
//   choice 'check' -> take the refund check; nothing is credited, balance unchanged.
// One-time, final, no undo. Idempotent: a repeat call no-ops and returns current state.
// All-or-nothing; a check is NEVER cut for any overage (handled upstream, none in v1).

function stateOf(credit) {
  return {
    status: credit.status,
    confirmedCents: Number(credit.confirmed_cents) || 0,
    topupCents: Number(credit.topup_cents) || 0,
    fullCents: Number(credit.full_cents) || 0
  };
}

export async function POST(request) {
  // DARK until go-live. Endpoint is closed when the flag is off, even though the
  // table + rows already exist — go-live is timed WITH Rob's parent email.
  if (!forgoRefundLive()) {
    return NextResponse.json({ error: "Not available." }, { status: 403 });
  }

  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const studentId = String(body.studentId || "");
  const choice = String(body.choice || "");
  if (!studentId) {
    return NextResponse.json({ error: "Missing student." }, { status: 400 });
  }
  if (choice !== "forgo" && choice !== "check") {
    return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
  }

  // A family can only act on their OWN student.
  const allowed = await isTrustedGuardian(session.personId, studentId);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized for this student." }, { status: 403 });
  }

  // Must have an offer on file.
  const { data: credit } = await supabaseAdmin
    .from("spring_trip_refund_credits")
    .select("student_id, confirmed_cents, topup_cents, full_cents, status, applied_at")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!credit) {
    return NextResponse.json({ error: "No refund offer on file." }, { status: 404 });
  }

  // Already decided -> idempotent no-op. One-time, final, no undo: we never change
  // a settled choice, in either direction.
  if (credit.status !== "offered") {
    return NextResponse.json({ changed: false, springTripRefund: stateOf(credit) });
  }

  const nowIso = new Date().toISOString();

  // ---- Take the refund check: just record the choice, write no payment. ----
  if (choice === "check") {
    const { data: updated } = await supabaseAdmin
      .from("spring_trip_refund_credits")
      .update({ status: "check", applied_at: nowIso })
      .eq("student_id", studentId)
      .eq("status", "offered") // lock: only the 'offered' -> done transition
      .select("student_id, confirmed_cents, topup_cents, full_cents, status, applied_at")
      .maybeSingle();
    const row = updated || credit;
    return NextResponse.json({ changed: Boolean(updated), springTripRefund: stateOf(row) });
  }

  // ---- Forgo the check: credit confirmed_cents to the MB funding goal. ----
  // Claim the offer first. The conditional update is the concurrency lock: only one
  // request can flip 'offered' -> 'applied_mb', so a double-click can't double-credit.
  const { data: claimed } = await supabaseAdmin
    .from("spring_trip_refund_credits")
    .update({ status: "applied_mb", applied_at: nowIso })
    .eq("student_id", studentId)
    .eq("status", "offered")
    .select("student_id, confirmed_cents, topup_cents, full_cents, status, applied_at")
    .maybeSingle();

  if (!claimed) {
    // Lost the race (already applied by a concurrent request) -> idempotent no-op.
    const { data: fresh } = await supabaseAdmin
      .from("spring_trip_refund_credits")
      .select("student_id, confirmed_cents, topup_cents, full_cents, status, applied_at")
      .eq("student_id", studentId)
      .maybeSingle();
    return NextResponse.json({ changed: false, springTripRefund: stateOf(fresh || credit) });
  }

  // Write the funding-goal credit. Deterministic invoice_id is a UNIQUE backstop:
  // even if this ran twice, the second insert fails and no second credit lands.
  const invoiceId = `sptrip-forgo-${studentId}`;
  const { error: payError } = await supabaseAdmin.from("fee_payments").insert({
    student_id: studentId,
    amount_cents: claimed.confirmed_cents,
    method: "credit",
    status: "completed",
    category: "marching_band_2026",
    kind: "funding_goal",
    invoice_id: invoiceId,
    is_sponsorship: false,
    payer_name: "Spring Trip refund (forgone)",
    recorded_by: "family_online",
    received_at: nowIso,
    notes:
      "Family forwent their cancelled Spring Trip 2026 refund; credited to the marching band funding goal."
  });

  if (payError) {
    // If the payment already exists (deterministic invoice_id collision from a retry),
    // the credit is on file -> treat as success. Otherwise roll the claim back to
    // 'offered' so the family can try again; never leave 'applied_mb' with no credit.
    const { data: existingPayment } = await supabaseAdmin
      .from("fee_payments")
      .select("id")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (!existingPayment) {
      await supabaseAdmin
        .from("spring_trip_refund_credits")
        .update({ status: "offered", applied_at: null })
        .eq("student_id", studentId)
        .eq("status", "applied_mb");
      return NextResponse.json({ error: "Could not apply your refund. Please try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ changed: true, springTripRefund: stateOf(claimed) });
}
