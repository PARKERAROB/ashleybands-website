import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";

const PUBLIC_INSTRUMENTS_PATH = path.join(process.cwd(), "content", "instruments-public.json");

function text(value) {
  return String(value || "").trim();
}

export async function GET() {
  try {
    const raw = await readFile(PUBLIC_INSTRUMENTS_PATH, "utf8");
    const snapshot = JSON.parse(raw);
    const instruments = Array.isArray(snapshot.instruments) ? snapshot.instruments : [];
    const typeCounts = new Map();
    for (const instrument of instruments) {
      const type = text(instrument.instrument_type) || "unspecified";
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
    return Response.json({
      generatedAt: snapshot.generatedAt || null,
      count: Number(snapshot.count ?? instruments.length),
      types: [...typeCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => a.type.localeCompare(b.type)),
    }, {
      headers: { "Cache-Control": "public, max-age=300" }
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      return Response.json({
        generatedAt: null,
        count: 0,
        types: [],
        warning: "Public instrument snapshot has not been generated yet.",
      });
    }
    return Response.json({ error: "Instrument summary is unavailable." }, { status: 500 });
  }
}

export async function POST(request) {
  const access = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ASSETS_WRITE);
  if (!access.ok) {
    return Response.json({ error: access.error }, {
      status: access.status,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
  const { allowed } = await checkRateLimit({
    key: `instrument-inventory:${clientIp(request)}`,
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
    const required = ["submitted_by", "instrument_type", "condition_notes"];
    const missing = required.filter((field) => !text(payload[field]));
    if (missing.length) {
      return Response.json({ error: "missing required fields", missing }, {
        status: 400,
        headers: { "Cache-Control": "private, no-store" }
      });
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

    if (error) {
      return Response.json({ error: "Could not save the instrument record." }, {
        status: 500,
        headers: { "Cache-Control": "private, no-store" }
      });
    }
    await logAudit({
      actor: staffActor(access.staff),
      action: "instrument_inventory.created",
      table: "instrument_inventory",
      recordId: data.id,
      changes: { instrument_type: text(payload.instrument_type) },
      route: "/api/instrument-inventory"
    });
    return Response.json({ id: data.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Could not save the instrument record." }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
}
