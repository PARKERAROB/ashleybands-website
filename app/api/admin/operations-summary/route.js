import { NextResponse } from "next/server";
import { logAudit, staffActor } from "@/lib/auditLog";
import { loadOperationsSummary } from "@/lib/operationsSummary";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { staffUsesAssignedScopes } from "@/lib/staffCapabilities";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request) {
  const authorization = await authorizeStaffRequest(
    request,
    STAFF_CAPABILITIES.OPERATIONS_SUMMARY_READ,
    { safeCapabilityOnly: true },
  );
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: PRIVATE_HEADERS });
  const staff = authorization.staff;

  try {
    if (staffUsesAssignedScopes(staff)) {
      const assignedCapabilities = [...new Set((authorization.scopes || []).map((scope) => scope.capability))];
      const allows = (capability) => assignedCapabilities.includes("*") || assignedCapabilities.includes(capability);
      const authorizedBuckets = [
        allows(STAFF_CAPABILITIES.BILLING_READ) ? "financial" : null,
        allows(STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ) ? "attendance" : null,
      ].filter(Boolean);
      await logAudit({
        actor: staffActor(staff),
        action: "view",
        table: "operational_summary",
        recordId: "scoped-shell",
        route: "/api/admin/operations-summary",
        changes: { scoped_shell: true, authorized_buckets: authorizedBuckets },
      });
      return NextResponse.json({ metrics: {}, unavailable: [], authorizedBuckets, authorizedCapabilities: assignedCapabilities, scoped: true, generatedAt: new Date().toISOString() }, { headers: PRIVATE_HEADERS });
    }
    const summary = await loadOperationsSummary(staff);
    await logAudit({
      actor: staffActor(staff),
      action: "view",
      table: "operational_summary",
      recordId: "current",
      route: "/api/admin/operations-summary",
      changes: { unavailable_areas: summary.unavailable },
    });
    return NextResponse.json(summary, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("[operations-summary] load failed:", error?.message || error);
    return NextResponse.json(
      { error: "Current operational summary could not be loaded." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
