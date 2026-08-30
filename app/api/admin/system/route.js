import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function rowError(results) {
  return results.find((result) => result.error)?.error || null;
}

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.SYSTEM_OVERSIGHT_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const results = await Promise.all([
      supabaseAdmin.from("staff")
        .select("id,email,display_name,role,created_at,disabled_at,disabled_reason")
        .order("display_name", { ascending: true }),
      supabaseAdmin.from("staff_scope_assignments")
        .select("id,staff_id,capability,scope_type,scope_ref,starts_at,ends_at,reason,source,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("audit_log")
        .select("id,occurred_at,actor_type,actor_name,action,table_name,record_id,route")
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("backup_runs")
        .select("id,backup_kind,status,source,source_ref,started_at,completed_at,backup_through_at,object_count,row_count,byte_count,manifest_sha256,storage_label,error_summary")
        .order("started_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("restore_verifications")
        .select("id,backup_run_id,status,target_label,source,started_at,completed_at,expected_object_count,verified_object_count,expected_row_count,verified_row_count,manifest_sha256,verification_sha256,error_summary,backup_runs(source_ref)")
        .order("started_at", { ascending: false })
        .limit(20),
      supabaseAdmin.from("portal_students")
        .select("id,display_name")
        .eq("status", "active")
        .order("display_name", { ascending: true })
        .limit(500),
      supabaseAdmin.from("attendance_events")
        .select("id,occurrence_key,title,starts_at,lifecycle_state")
        .or("lifecycle_state.is.null,lifecycle_state.neq.superseded")
        .order("starts_at", { ascending: false })
        .limit(200),
    ]);
    const error = rowError(results);
    if (error) throw error;
    const [staff, scopes, audit, backups, restores, students, attendanceEvents] = results.map((result) => result.data || []);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "view_system_oversight",
      table: "staff,staff_scope_assignments,audit_log,backup_runs,restore_verifications",
      recordId: "current",
      route: "/api/admin/system",
    });
    return privateJson({
      generatedAt: new Date().toISOString(),
      viewerId: authorization.staff.id,
      staff,
      scopes,
      audit,
      backups,
      restores,
      scopeOptions: {
        student: students.map((student) => ({ value: student.id, label: student.display_name })),
        attendance_event: attendanceEvents.map((event) => ({
          value: event.occurrence_key,
          label: `${event.title} · ${event.starts_at ? new Date(event.starts_at).toLocaleDateString("en-US") : "date not recorded"}`,
        })),
      },
    });
  } catch (error) {
    return privateServerError("admin-system", error, "System oversight could not be loaded or durably attributed.");
  }
}

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.STAFF_ACCESS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const body = await request.json().catch(() => ({}));
  const targetStaffId = String(body.targetStaffId || "").trim();
  const action = String(body.action || "").trim();
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (!targetStaffId || !reason || !["disable", "enable", "change_role", "grant_scope", "end_scope"].includes(action)) {
    return privateJson({ error: "A staff account, valid action, and reason are required." }, 400);
  }
  try {
    const { data, error } = await supabaseAdmin.rpc("manage_staff_access_with_audit", {
      p_target_staff_id: targetStaffId,
      p_action: action,
      p_role: body.role ? String(body.role) : null,
      p_capability: body.capability ? String(body.capability) : null,
      p_scope_type: body.scopeType ? String(body.scopeType) : null,
      p_scope_ref: body.scopeRef ? String(body.scopeRef).trim() : "",
      p_reason: reason,
      p_actor_staff_id: authorization.staff.id,
      p_route: "/api/admin/system",
    });
    if (error) throw error;
    return privateJson({ ok: true, result: data });
  } catch (error) {
    console.error("[admin-system-access]", error?.message || error);
    return privateJson({ error: "The access change was not completed. Check the account, scope, and director safeguards." }, 400);
  }
}
