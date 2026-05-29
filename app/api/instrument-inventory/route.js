import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PUBLIC_INSTRUMENTS_PATH = path.join(process.cwd(), "content", "instruments-public.json");

function text(value) {
  return String(value || "").trim();
}

export async function GET() {
  try {
    const raw = await readFile(PUBLIC_INSTRUMENTS_PATH, "utf8");
    const snapshot = JSON.parse(raw);
    const instruments = Array.isArray(snapshot.instruments) ? snapshot.instruments : [];
    return Response.json({
      instruments,
      generatedAt: snapshot.generatedAt || null,
      count: Number(snapshot.count ?? instruments.length),
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return Response.json({
        instruments: [],
        generatedAt: null,
        count: 0,
        warning: "Public instrument snapshot has not been generated yet.",
      });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const required = ["submitted_by", "instrument_type", "condition_notes"];
    const missing = required.filter((field) => !text(payload[field]));
    if (missing.length) {
      return Response.json({ error: "missing required fields", missing }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("instrument_inventory")
      .insert({
        asset_id: text(payload.asset_id),
        submitted_by: text(payload.submitted_by),
        instrument_type: text(payload.instrument_type),
        brand: text(payload.brand),
        model_markings: text(payload.model_markings || payload.model),
        serial_number: text(payload.serial_number),
        serial_location: text(payload.serial_location),
        finish: text(payload.finish),
        key_or_pitch: text(payload.key_or_pitch || payload.key_pitch),
        level: text(payload.level),
        locker: text(payload.locker),
        location: text(payload.location),
        repair_needed: text(payload.repair_needed),
        repair_priority: text(payload.repair_priority),
        condition_notes: text(payload.condition_notes),
        visible_damage: text(payload.visible_damage),
        missing_parts: text(payload.missing_parts),
        plays: payload.plays || "",
        case_present: payload.case_present || "",
        mouthpiece_present: payload.mouthpiece_present || "",
        raw_transcript: text(payload.raw_transcript),
      })
      .select("id")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
