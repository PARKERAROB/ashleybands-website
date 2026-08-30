import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

// Auto-generated provenance statement (placement-authority-2026-27, phase 0
// build list item 6 / phase 2.2). Read-only counts of where person-data lives
// and, for the portal tables, whether a family has ever touched it -- see
// provenance-lane-map.md for the narrative this page keeps live.
//
// Every query is best-effort: a missing table/view (schema drift, a table
// retired or not yet migrated) must never break the whole page -- it reports
// as unavailable for that one row instead of 500ing the route.

async function safeCount(table, build) {
  try {
    let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    if (build) query = build(query);
    const { count, error } = await query;
    if (error) return { available: false, error: error.message };
    return { available: true, count: count ?? 0 };
  } catch (err) {
    return { available: false, error: err?.message || String(err) };
  }
}

async function safeGroupCount(table, column) {
  try {
    const { data, error } = await supabaseAdmin.from(table).select(column).limit(20000);
    if (error) return { available: false, error: error.message };
    const byValue = (data || []).reduce((acc, row) => {
      const key = row[column] ?? "(none)";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return { available: true, total: (data || []).length, byValue };
  } catch (err) {
    return { available: false, error: err?.message || String(err) };
  }
}

export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SYSTEM_DATA_INVENTORY_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const staff = authorization.staff;

  const [
    portalStudents,
    portalPeople,
    portalStudentPeople,
    portalHouseholds,
    portalAccessRequests,
    portalUpdateRequests,
    portalMagicLinksTotal,
    portalMagicLinksConsumed,
    portalReviewQueueOpen,
    contactMethodsBySource,
    studentsTouched,
    studentsUntouched,
    peopleTouched,
    peopleUntouched,
    legacyStudents,
    legacyGuardians,
    legacyFamilies,
    mbSignups
  ] = await Promise.all([
    safeCount("portal_students"),
    safeCount("portal_people"),
    safeCount("portal_student_people"),
    safeCount("portal_households"),
    safeCount("portal_access_requests"),
    safeCount("portal_update_requests"),
    safeCount("portal_magic_links"),
    safeCount("portal_magic_links", (q) => q.not("consumed_at", "is", null)),
    safeCount("portal_review_queue", (q) =>
      q.in("status", ["new", "needs_review", "needs_followup"])
    ),
    safeGroupCount("portal_contact_methods", "source"),
    safeCount("portal_student_family_touch", (q) => q.eq("touched_by_family", true)),
    safeCount("portal_student_family_touch", (q) => q.eq("touched_by_family", false)),
    safeCount("portal_person_family_touch", (q) => q.eq("touched_by_family", true)),
    safeCount("portal_person_family_touch", (q) => q.eq("touched_by_family", false)),
    // Legacy System-A tables (provenance-lane-map §2): live but schema-drift,
    // no migration file. Existence-only count -- never assume their columns.
    safeCount("students"),
    safeCount("guardians"),
    safeCount("families"),
    safeCount("marching_band_signup_2026")
  ]);

  await logAudit({
    actor: staffActor(staff),
    action: "view",
    table: "data_inventory",
    route: "/api/admin/data-inventory"
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    staff: { displayName: staff.display_name, role: staff.role },
    portal: {
      students: portalStudents,
      people: portalPeople,
      studentPeopleLinks: portalStudentPeople,
      households: portalHouseholds,
      accessRequests: portalAccessRequests,
      updateRequests: portalUpdateRequests,
      magicLinksIssued: portalMagicLinksTotal,
      magicLinksConsumed: portalMagicLinksConsumed,
      reviewQueueOpen: portalReviewQueueOpen,
      contactMethodsBySource
    },
    touchedByFamily: {
      studentsTouched,
      studentsUntouched,
      peopleTouched,
      peopleUntouched
    },
    legacySystemA: {
      students: legacyStudents,
      guardians: legacyGuardians,
      families: legacyFamilies
    },
    marchingBandSignups2026: mbSignups
  });
}
