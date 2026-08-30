import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadFormOperations } from "@/lib/formOperations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit, staffActor } from "@/lib/auditLog";

const STATES = new Set(["not_started","submitted","needs_review","needs_correction","complete","waived","not_required","reopened"]);
const MODES = new Set(["portal","external","paper","staff_record"]);

function privateJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.FORMS_STATUS_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const data = await loadFormOperations();
    const studentId = new URL(request.url).searchParams.get("student") || "";
    await logAudit({
      actor: staffActor(authorization.staff), action: "view",
      table: "form_requirements,student_form_requirements",
      recordId: studentId || "active-students", route: "/api/admin/forms",
      changes: { student_scope: studentId || null },
    });
    return privateJson(data);
  } catch {
    return privateJson({ error: "Could not load form requirements." }, 500);
  }
}

export async function PATCH(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.FORMS_MANAGE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const body = await request.json().catch(() => ({}));
  const requirementId = String(body.requirementId || "");
  const studentId = String(body.studentId || "");
  const state = String(body.state || "");
  const completionMode = String(body.completionMode || "staff_record");
  if (!requirementId || !studentId || !STATES.has(state) || !MODES.has(completionMode)) {
    return privateJson({ error: "A valid requirement, student, state, and completion mode are required." }, 400);
  }
  const { data: definition } = await supabaseAdmin.from("form_requirements")
    .select("id,form_versions(delivery_type)").eq("id", requirementId).maybeSingle();
  const version = Array.isArray(definition?.form_versions) ? definition.form_versions[0] : definition?.form_versions;
  if (!definition) return privateJson({ error: "Form requirement not found." }, 404);
  if (version?.delivery_type === "portal") {
    return privateJson({ error: "This status is owned by its connected portal workflow." }, 409);
  }
  const note = String(body.note || "").trim().slice(0, 300);
  const { data, error } = await supabaseAdmin.rpc("set_student_form_requirement_state", {
    p_requirement_id: requirementId,
    p_student_id: studentId,
    p_state: state,
    p_completion_mode: completionMode,
    p_next_action: String(body.nextAction || "").trim().slice(0, 200),
    p_note_summary: note,
    p_actor_staff_id: authorization.staff.id,
  });
  if (error) return privateJson({ error: "Could not update the form status." }, 500);
  await logAudit({
    actor: staffActor(authorization.staff), action: "update_status",
    table: "student_form_requirements", recordId: data,
    route: "/api/admin/forms", changes: { student_id: studentId, requirement_id: requirementId, state },
  });
  return privateJson({ id: data, state });
}
