import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { trustedStudentIds, loadStudentLedgers } from "@/lib/billing";
import { isPaypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";

export async function GET(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const studentIds = await trustedStudentIds(session.personId);
  if (!studentIds.length) {
    return NextResponse.json({ students: [], paymentsEnabled: isPaypalConfigured() });
  }

  const { data: studentRows } = await supabaseAdmin
    .from("portal_students")
    .select("id, display_name, preferred_first")
    .in("id", studentIds);

  const { charges, payments, balances } = await loadStudentLedgers(studentIds);

  const students = (studentRows || []).map((s) => {
    const bal = balances[s.id] || { charged_cents: 0, paid_cents: 0, balance_cents: 0 };
    return {
      id: s.id,
      name: s.display_name,
      chargedCents: Number(bal.charged_cents) || 0,
      paidCents: Number(bal.paid_cents) || 0,
      balanceCents: Number(bal.balance_cents) || 0,
      charges: (charges[s.id] || []).map((c) => ({
        id: c.id,
        label: c.label || c.category,
        amountCents: c.amount_cents,
        status: c.status,
        createdAt: c.created_at
      })),
      payments: (payments[s.id] || [])
        .filter((p) => p.status === "completed")
        .map((p) => ({
          id: p.id,
          amountCents: p.amount_cents,
          method: p.method,
          isSponsorship: !!p.is_sponsorship,
          payerName: p.payer_name || "",
          receivedAt: p.received_at || p.created_at,
          note: p.notes || ""
        }))
    };
  });

  return NextResponse.json({ students, paymentsEnabled: isPaypalConfigured() });
}
