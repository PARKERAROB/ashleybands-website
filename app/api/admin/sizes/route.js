import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";
import { computeSize, chartForRole } from "@/lib/uniformSizing";

export const runtime = "nodejs";

function text(v) {
  return String(v || "").trim();
}

// Build the row the table renders: the recommendation is computed on read from the
// measurements (never stored -- the measurements own that fact), then Rob's override is
// layered on top. If he overrode and the math has MOVED since (a re-measure), the row
// carries drift: his pick still wins, but he gets told the basis changed.
function buildRow(student, measurement) {
  const computed = computeSize(measurement, {
    mbRole: student.mb_role_2026,
    instrument: null
  });
  const override = measurement?.size_override || null;
  const computedAtOverride = measurement?.size_computed_at_override || null;
  const drifted = Boolean(override && computedAtOverride && computed.size && computedAtOverride !== computed.size);

  return {
    studentId: student.id,
    sourceStudentId: student.source_student_id,
    name: student.display_name,
    grade: student.grade_fall26,
    role: student.mb_role_2026,
    lane: computed.lane,
    chartLabel: computed.chartLabel,
    guideUrl: computed.guideUrl,
    measurements: {
      chest: measurement?.chest_in ?? null,
      waist: measurement?.waist_in ?? null,
      hips: measurement?.hips_in ?? null,
      height: measurement?.height ?? null,
      neck: measurement?.neck_in ?? null,
      arm: measurement?.arm_length_in ?? null,
      inseam: measurement?.inseam_in ?? null
    },
    per: computed.per,
    computedSize: computed.size,
    sizeOptions: computed.sizes,
    lengthClass: computed.lengthClass,
    heightInches: computed.heightInches,
    unparsedHeight: computed.unparsedHeight,
    garment: computed.garment || null,
    partial: computed.partial,
    measuredCount: computed.measuredCount,
    spread: computed.spread,
    wideSpread: computed.wideSpread,
    finalSize: override || computed.size,
    override,
    overrideBy: measurement?.size_override_by || null,
    overrideAt: measurement?.size_override_at || null,
    computedAtOverride,
    drifted,
    measuredBy: measurement?.measured_by || null,
    measuredAt: measurement?.measured_at || null
  };
}

// GET -> every student that has a measurement row, with recommendation + override.
// Students with no measurements are omitted: a size table is about what we can size,
// and the measured-count on /admin/measurements already tracks fitting progress.
export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: measurements, error: mErr } = await supabaseAdmin
    .from("portal_student_measurements")
    .select("*");
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  if (!measurements?.length) return NextResponse.json({ rows: [] });

  const ids = measurements.map((m) => m.student_id);
  const { data: students, error: sErr } = await supabaseAdmin
    .from("portal_students")
    .select("id, source_student_id, display_name, grade_fall26, mb_role_2026")
    .in("id", ids);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const byId = new Map((students || []).map((s) => [s.id, s]));
  const rows = measurements
    .map((m) => {
      const s = byId.get(m.student_id);
      return s ? buildRow(s, m) : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  await logAudit({
    actor: staffActor(staff),
    action: "view",
    table: "portal_student_measurements",
    recordId: "sizes-table",
    route: "/api/admin/sizes"
  });

  return NextResponse.json({ rows });
}

// PUT { studentId, size } -> set (or clear, with size="") Rob's override.
export async function PUT(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const studentId = text(body.studentId);
  const size = text(body.size);
  if (!studentId) return NextResponse.json({ error: "Missing studentId" }, { status: 400 });

  const { data: student, error: sErr } = await supabaseAdmin
    .from("portal_students")
    .select("id, mb_role_2026")
    .eq("id", studentId)
    .maybeSingle();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!student) return NextResponse.json({ error: "No such student" }, { status: 404 });

  const { data: measurement, error: mErr } = await supabaseAdmin
    .from("portal_student_measurements")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  if (!measurement) return NextResponse.json({ error: "That student has no measurements yet." }, { status: 400 });

  // Only a size that actually exists on that student's chart -- a free-text size would
  // reach Synced Up as an unfillable order line.
  const chart = chartForRole(student.mb_role_2026, null);
  const valid = chart.sizes.map((s) => s.size);
  if (size && !valid.includes(size)) {
    return NextResponse.json(
      { error: `"${size}" is not a ${chart.label} size. Valid: ${valid.join(", ")}` },
      { status: 400 }
    );
  }

  const computed = computeSize(measurement, { mbRole: student.mb_role_2026, instrument: null });
  const now = new Date().toISOString();
  const payload = size
    ? {
        size_override: size,
        size_override_by: staff.display_name,
        size_override_at: now,
        // snapshot the basis so a later re-measure shows as drift, not a silent swap
        size_computed_at_override: computed.size,
        updated_at: now
      }
    : {
        size_override: null,
        size_override_by: null,
        size_override_at: null,
        size_computed_at_override: null,
        updated_at: now
      };

  const { error } = await supabaseAdmin
    .from("portal_student_measurements")
    .update(payload)
    .eq("student_id", studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: size ? "size_override" : "size_override_clear",
    table: "portal_student_measurements",
    recordId: studentId,
    route: "/api/admin/sizes",
    changes: {
      size_override: { old: measurement.size_override ?? null, new: size || null },
      computed_size_at_the_time: { old: measurement.size_computed_at_override ?? null, new: size ? computed.size : null }
    }
  });

  return NextResponse.json({ ok: true, computedSize: computed.size, finalSize: size || computed.size });
}
