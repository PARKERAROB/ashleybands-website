import { privateJson } from "@/lib/privateResponse";
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
    return privateJson({ error: "Not available." }, 403);
  }

  const session = readPortalSession(request);
  if (!session?.personId) {
    return privateJson({ error: "Not signed in." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid request." }, 400);
  }

  const studentId = String(body.studentId || "");
  const choice = String(body.choice || "");
  if (!studentId) {
    return privateJson({ error: "Missing student." }, 400);
  }
  if (choice !== "forgo" && choice !== "check") {
    return privateJson({ error: "Invalid choice." }, 400);
  }

  // A family can only act on their OWN student.
  const allowed = await isTrustedGuardian(session.personId, studentId);
  if (!allowed) {
    return privateJson({ error: "Not authorized for this student." }, 403);
  }

  // The offer lock, funding-goal credit, final disposition, and audit row share
  // one database transaction. The RPC also re-checks guardian authority so a
  // stale application session cannot widen the family boundary.
  const { data, error } = await supabaseAdmin.rpc("apply_spring_trip_refund_choice", {
    p_student_id: studentId,
    p_choice: choice,
    p_actor_person_id: session.personId,
    p_route: "/api/billing/forgo-refund",
  });
  if (error) {
    if (error.code === "P0002") {
      return privateJson({ error: "No refund offer on file." }, 404);
    }
    return privateJson({ error: "Could not record this choice. Please try again." }, 500);
  }
  return privateJson({
    changed: Boolean(data?.changed),
    springTripRefund: stateOf(data || {}),
  });
}
