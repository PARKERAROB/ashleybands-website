import { NextResponse } from "next/server";
import { authorizePortalStudentRequest } from "@/lib/portalAuthorization";
import { loadOnboardingRecord, ONBOARDING_FORM_VERSION } from "@/lib/onboarding";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function response(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function cleanId(value) {
  return String(value || "").trim();
}

export async function GET(request) {
  const studentId = cleanId(new URL(request.url).searchParams.get("studentId"));
  const authorization = await authorizePortalStudentRequest(request, studentId, { strong: true });
  if (!authorization.ok) {
    return response({ error: authorization.error, code: authorization.code }, authorization.status);
  }

  try {
    const onboarding = await loadOnboardingRecord(authorization.student);
    await logAudit({
      actor: {
        type: authorization.person.person_type === "student" ? "student" : "parent",
        id: authorization.person.id,
      },
      action: "onboarding.view",
      table: "connected_student_onboarding",
      recordId: studentId,
      route: "/api/portal/onboarding",
    });
    return response({ onboarding });
  } catch (error) {
    console.error("[onboarding] load failed:", error?.message || error);
    return response({ error: "The onboarding record could not be loaded." }, 500);
  }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const studentId = cleanId(body.studentId);
  const authorization = await authorizePortalStudentRequest(request, studentId, { strong: true });
  if (!authorization.ok) {
    return response({ error: authorization.error, code: authorization.code }, authorization.status);
  }

  const step = Number(body.step);
  const idempotencyKey = cleanId(body.idempotencyKey);
  if (!Number.isInteger(step) || step < 1 || step > 6) {
    return response({ error: "Choose a valid onboarding step." }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return response({ error: "This save request is missing its confirmation key." }, 400);
  }

  const { data, error } = await supabaseAdmin.rpc("portal_save_onboarding_step", {
    p_actor_person_id: authorization.person.id,
    p_student_id: studentId,
    p_form_version: ONBOARDING_FORM_VERSION,
    p_step_number: step,
    p_payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
    if (status === 500) console.error("[onboarding] save failed:", error.message);
    return response({ error: status === 500 ? "This onboarding step could not be saved." : error.message }, status);
  }

  try {
    const onboarding = await loadOnboardingRecord(authorization.student);
    return response({ result: data, onboarding });
  } catch (error) {
    console.error("[onboarding] reload failed:", error?.message || error);
    return response({ result: data, onboarding: null });
  }
}
