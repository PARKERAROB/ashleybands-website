import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadFinancialOperations } from "@/lib/financialOperations";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("student") || "";
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.BILLING_READ, {
    scope: studentId ? { type: "student", ref: studentId } : undefined,
    collectionScopeType: studentId ? undefined : "student",
  });
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const data = await loadFinancialOperations({
      studentIds: studentId
        ? [studentId]
        : authorization.scopeFilter?.global === false ? authorization.scopeFilter.refs : null,
    });
    await logAudit({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "fee_charges,fee_payments,sponsor_gifts",
      recordId: studentId || "active-students",
      route: "/api/admin/financial",
      changes: { student_scope: studentId || null },
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Could not load current financial records." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
