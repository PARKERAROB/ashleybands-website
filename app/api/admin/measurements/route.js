import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

const NUMERIC_FIELDS = [
  ["weightLbs", "weight_lbs"],
  ["chestIn", "chest_in"],
  ["waistIn", "waist_in"],
  ["hipsIn", "hips_in"],
  ["inseamIn", "inseam_in"],
  ["backLengthIn", "back_length_in"],
  ["girthIn", "girth_in"],
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

// GET ?studentId=<uuid> -> the current measurement row for that student (or null).
// GET (no studentId)    -> { measuredCount } across all students, for a progress readout.
export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const studentId = text(new URL(req.url).searchParams.get("studentId"));

  if (!studentId) {
    const { count, error } = await supabaseAdmin
      .from("portal_student_measurements")
      .select("id", { count: "exact", head: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ measuredCount: count || 0 });
  }

  const { data, error } = await supabaseAdmin
    .from("portal_student_measurements")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "view",
    table: "portal_student_measurements",
    recordId: studentId,
    route: "/api/admin/measurements"
  });

  return NextResponse.json({ measurement: data || null });
}

// PUT -> upsert the measurement row for a student. body: studentId + measurement fields.
export async function PUT(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = text(body.studentId);
  if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

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
    source: "staff_manual",
    measured_by: staff.display_name,
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
    actor: staffActor(staff),
    action: "upsert",
    table: "portal_student_measurements",
    recordId: studentId,
    route: "/api/admin/measurements",
    changes
  });

  return NextResponse.json({ ok: true });
}
