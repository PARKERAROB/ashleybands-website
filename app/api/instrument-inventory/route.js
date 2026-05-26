import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request) {
  try {
    const payload = await request.json();
    const required = ["submitted_by", "instrument_type", "condition_notes"];
    const missing = required.filter((f) => !String(payload[f] || "").trim());
    if (missing.length) {
      return Response.json({ error: "missing required fields", missing }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("instrument_inventory")
      .insert({
        submitted_by: String(payload.submitted_by || "").trim(),
        instrument_type: String(payload.instrument_type || "").trim(),
        brand: String(payload.brand || "").trim(),
        model_markings: String(payload.model_markings || "").trim(),
        serial_number: String(payload.serial_number || "").trim(),
        serial_location: String(payload.serial_location || "").trim(),
        finish: String(payload.finish || "").trim(),
        key_or_pitch: String(payload.key_or_pitch || "").trim(),
        level: String(payload.level || "").trim(),
        condition_notes: String(payload.condition_notes || "").trim(),
        visible_damage: String(payload.visible_damage || "").trim(),
        missing_parts: String(payload.missing_parts || "").trim(),
        plays: payload.plays || "",
        case_present: payload.case_present || "",
        mouthpiece_present: payload.mouthpiece_present || "",
        raw_transcript: String(payload.raw_transcript || "").trim()
      })
      .select("id")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}