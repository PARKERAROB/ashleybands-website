import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(request) {
  const { allowed } = await checkRateLimit({
    key: `music-library:${clientIp(request)}`,
    limit: 10,
    windowMs: 10 * 60 * 1000
  });
  if (!allowed) {
    return Response.json({ error: "Too many submissions. Please try again in a little while." }, { status: 429 });
  }
  try {
    const payload = await request.json();
    if (!String(payload.title || "").trim()) {
      return Response.json({ error: "Title is required" }, { status: 400 });
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

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}