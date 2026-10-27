import { privateJson } from "@/lib/privateResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { loadCarnegieAdultAccounts } from "@/lib/carnegieAdults";

export const runtime = "nodejs";

const GLOBAL = { scope: { type: "global", ref: "" } };

// Mr. Parker's adults list (#237): every adult a family added, with room choice, chaperone
// request, and what the family has paid toward adult travel.
export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.BILLING_READ, GLOBAL);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const { data: adults, error } = await supabaseAdmin.from("carnegie_adult_travelers")
    .select("id,student_id,adult_name,travel_option,room_type,chaperone_interest,official_chaperone,price_cents,status,created_at,portal_students(display_name)")
    .eq("status", "active").order("created_at");
  if (error) return privateJson({ error: "Could not load adults." }, 500);
  const studentIds = [...new Set((adults || []).map((row) => row.student_id))];
  const accounts = await loadCarnegieAdultAccounts(studentIds);
  await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "carnegie_adult_travelers", recordId: "carnegie-adults", route: "/api/admin/carnegie-adults" });
  return privateJson({
    adults: (adults || []).map((row) => ({
      id: row.id,
      name: row.adult_name,
      student: row.portal_students?.display_name || "",
      studentId: row.student_id,
      option: row.travel_option === "own_way" ? 3 : row.chaperone_interest || row.official_chaperone ? 1 : 2,
      roomType: row.room_type,
      chaperoneRequested: row.chaperone_interest,
      official: row.official_chaperone,
      priceCents: row.price_cents,
      addedAt: row.created_at,
    })),
    families: accounts || {},
  });
}

// body: { id, action: "official" | "not_official" | "remove" }
export async function PATCH(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.BILLING_WRITE, GLOBAL);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "");
  const now = new Date().toISOString();
  const staffName = authorization.staff?.display_name || authorization.staff?.email || "staff";
  const changes = {
    official: { official_chaperone: true, official_set_by: staffName, official_set_at: now, updated_at: now },
    not_official: { official_chaperone: false, official_set_by: staffName, official_set_at: now, updated_at: now },
    remove: { status: "withdrawn", updated_at: now },
  }[action];
  if (!id || !changes) return privateJson({ error: "Choose an adult and an action." }, 400);
  const { error, count } = await supabaseAdmin.from("carnegie_adult_travelers")
    .update(changes, { count: "exact" }).eq("id", id).eq("status", "active");
  if (error || count !== 1) return privateJson({ error: "That adult could not be updated." }, 409);
  await logAudit({ actor: staffActor(authorization.staff), action: `carnegie_adult_${action}`, table: "carnegie_adult_travelers", recordId: id, changes, route: "/api/admin/carnegie-adults" });
  return privateJson({ ok: true });
}
