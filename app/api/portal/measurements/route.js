import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

// girth_in, weight_lbs, back_length_in dropped from the form 2026-07-16 (Rob) --
// no Band Shoppe guide asks for them. Deliberately NOT listed here: the columns
// remain in the table, and leaving them out of the payload means an upsert
// preserves any existing value instead of nulling it. Restoring one is one line.
const NUMERIC_FIELDS = [
  ["chestIn", "chest_in"],
  ["waistIn", "waist_in"],
  ["hipsIn", "hips_in"],
  ["inseamIn", "inseam_in"],
  ["neckIn", "neck_in"],
  ["armLengthIn", "arm_length_in"]
];

// Vendor sizes, not tape measurements: kept as text so "10.5 M" / "2XL" survive
// intact (same reasoning as height). See migration 0031.
const TEXT_FIELDS = [
  ["shoeSize", "shoe_size"],
  ["gloveSize", "glove_size"],
  ["shirtSize", "shirt_size"]
];

function text(v) {
  return String(v || "").trim();
}

// Does this signed-in guardian own this student? Query copied verbatim from the
// canonical portal scope check in app/api/portal/update-request/route.js. This is
// the ENTIRE security boundary: supabaseAdmin is a service-role client with no RLS
// backstop, so a family can only ever reach a student they hold a *trusted* link to.
// Never drop the relationship_status='trusted' filter.
async function hasTrustedStudentAccess(personId, studentId) {
  if (!personId || !studentId) return false;
  const { data } = await supabaseAdmin
    .from("portal_student_people")
    .select("id")
    .eq("person_id", personId)
    .eq("student_id", studentId)
    .eq("relationship_status", "trusted")
    .maybeSingle();
  return Boolean(data);
}

function parentActor(session) {
  return { type: "parent", id: session.personId, name: session.email };
}

// GET ?studentId= -> that student's current measurements. A family only ever sees
// their own student's row (the trusted-access gate runs before any read).
export async function GET(req) {
  const session = readPortalSession(req);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const studentId = text(new URL(req.url).searchParams.get("studentId"));
  if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
  if (!(await hasTrustedStudentAccess(session.personId, studentId))) {
    return NextResponse.json({ error: "Not authorized for this student." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("portal_student_measurements")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: parentActor(session),
    action: "view",
    table: "portal_student_measurements",
    recordId: studentId,
    route: "/api/portal/measurements"
  });

  return NextResponse.json({ measurement: data || null });
}

// PUT -> upsert the family's own student's measurements. Auto-applied, no approval
// gate (per docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md).
export async function PUT(req) {
  const session = readPortalSession(req);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = text(body.studentId);
  if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
  if (!(await hasTrustedStudentAccess(session.personId, studentId))) {
    return NextResponse.json({ error: "Not authorized for this student." }, { status: 403 });
  }

  const { data: current, error: loadError } = await supabaseAdmin
    .from("portal_student_measurements")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const payload = {
    student_id: studentId,
    gender: text(body.gender) || null,
    height: text(body.height) || null,
    notes: text(body.notes) || null,
    source: "portal_self_edit",
    measured_by: session.email || "family",
    measured_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  for (const [key, column] of NUMERIC_FIELDS) {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === "") {
      payload[column] = null;
      continue;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) {
      return NextResponse.json({ error: `Invalid number for ${key}` }, { status: 400 });
    }
    payload[column] = num;
  }

  for (const [key, column] of TEXT_FIELDS) {
    payload[column] = text(body[key]) || null;
  }

  const { error } = await supabaseAdmin
    .from("portal_student_measurements")
    .upsert(payload, { onConflict: "student_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const changes = {};
  for (const field of Object.keys(payload)) {
    if (field === "student_id" || field === "measured_at" || field === "updated_at" || field === "source") continue;
    const oldValue = current ? current[field] ?? null : null;
    const newValue = payload[field] ?? null;
    if (oldValue !== newValue) changes[field] = { old: oldValue, new: newValue };
  }

  await logAudit({
    actor: parentActor(session),
    action: "upsert",
    table: "portal_student_measurements",
    recordId: studentId,
    route: "/api/portal/measurements",
    changes
  });

  return NextResponse.json({ ok: true });
}
