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

// Database validation text is written for developers. Families see these instead.
const FAMILY_SAVE_MESSAGES = {
  "Invalid personal email": "Check the personal email address. It does not look complete.",
  "One to four guardians are required": "Add at least one guardian and no more than four.",
  "Guardian 1 is incomplete": "Add Guardian 1's name, relationship, email, and phone to continue.",
  "Invalid guardian email": "Check the guardian email addresses. One does not look complete.",
  "Primary instrument is required": "Choose a primary instrument to continue.",
  "Previous school is required": "Choose the previous school to continue.",
  "Outside-county school, city, and state are required": "Add the previous school's name, city, and state to continue.",
  "Invalid shirt size": "Choose a shirt size from the list.",
  "Accuracy confirmation is required": "Check the box to confirm the information is accurate.",
  "Primary guardian record is incomplete": "Guardian 1's information is not complete. Go back to the Family step to finish it.",
  "Music background is incomplete": "The music background is not complete. Go back to the Music step to finish it.",
  "Strongly verified student relationship required": "This family connection must be verified before onboarding can be saved.",
};

function familySaveMessage(error, status) {
  const known = FAMILY_SAVE_MESSAGES[String(error?.message || "").trim()];
  if (known) return known;
  if (status === 403) return "This account cannot save onboarding for this student. Email Mr. Parker for help.";
  if (status === 400) return "Something on this step needs another look. Check your answers and try again.";
  return "This onboarding step could not be saved. Please try again in a few minutes.";
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
    else console.warn("[onboarding] save rejected:", error.message);
    return response({ error: familySaveMessage(error, status) }, status);
  }

  try {
    const onboarding = await loadOnboardingRecord(authorization.student);
    return response({ result: data, onboarding });
  } catch (error) {
    console.error("[onboarding] reload failed:", error?.message || error);
    return response({ result: data, onboarding: null });
  }
}
