import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

export async function POST(request) {
  const access = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ASSETS_WRITE);
  if (!access.ok) {
    return Response.json({ error: access.error }, {
      status: access.status,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
  const { allowed } = await checkRateLimit({
    key: `music-library:${clientIp(request)}`,
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!allowed) {
    return Response.json({ error: "Too many submissions. Please try again in a little while." }, {
      status: 429,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
  try {
    const payload = await request.json();
    if (!String(payload.title || "").trim()) {
      return Response.json({ error: "Title is required" }, {
        status: 400,
        headers: { "Cache-Control": "private, no-store" }
      });
    }

    const { data, error } = await supabaseAdmin
      .from("music_library_inventory")
      .insert({
        submitted_by: String(payload.submitted_by || "").trim(),
        title: String(payload.title || "").trim(),
        composer: String(payload.composer || "").trim(),
        arranger_editor: String(payload.arranger_editor || "").trim(),
        publisher: String(payload.publisher || "").trim(),
        catalog_number: String(payload.catalog_number || "").trim(),
        year: String(payload.year || "").trim(),
        duration: String(payload.duration || "").trim(),
        ensemble_type: payload.ensemble_type || "",
        publisher_grade: String(payload.publisher_grade || "").trim(),
        library_status: payload.library_status || "",
        physical_location: String(payload.physical_location || "").trim(),
        score_status: payload.score_status || "",
        parts_status: payload.parts_status || "",
        missing_parts: String(payload.missing_parts || "").trim(),
        acquired_not_filed: String(payload.acquired_not_filed || "").trim(),
        condition_notes: String(payload.condition_notes || "").trim(),
        ready_to_use: payload.ready_to_use || "",
        raw_transcript: String(payload.raw_transcript || "").trim(),
      })
      .select("id")
      .single();

    if (error) {
      return Response.json({ error: "Could not save the music record." }, {
        status: 500,
        headers: { "Cache-Control": "private, no-store" }
      });
    }
    await logAudit({
      actor: staffActor(access.staff),
      action: "music_library.created",
      table: "music_library_inventory",
      recordId: data.id,
      changes: { title_present: true },
      route: "/api/music-library"
    });
    return Response.json({ id: data.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Could not save the music record." }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
}
