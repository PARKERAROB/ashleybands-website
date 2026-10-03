import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadAscendDay } from "@/lib/ascendCheckServer";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  MAX_BODY_BYTES,
  normalizeAscendPayload,
  normalizeDrillNumber,
  normalizeRehearsalCode,
  rehearsalDate,
} from "@/lib/ascendCheck.mjs";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
const TEN_MINUTES = 10 * 60 * 1000;

function sameCode(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Public, no-login submit (#172). Anyone with the staff-set rehearsal code can send one
// self check per drill number per rehearsal day; a resend overwrites it.
export async function POST(request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "Send your self check from the Ashley Bands page." }, 403);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "That self check is too large to send." }, 413);

  let drillNumber;
  let payload;
  let code;
  try {
    const body = JSON.parse(raw || "{}");
    drillNumber = normalizeDrillNumber(body.drillNumber);
    code = normalizeRehearsalCode(body.code);
    payload = normalizeAscendPayload(body);
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? "That self check is not valid." : error.message }, 400);
  }

  // School Wi-Fi puts a whole band behind one address, so the network limit is generous.
  const networkRate = await checkRateLimit({ key: `ascend-check:network:${clientIp(request)}`, limit: 1000, windowMs: TEN_MINUTES, failOpen: false });
  if (!networkRate.allowed) return json({ error: "Too many sends. Wait a few minutes and try again." }, 429);

  const { data: setting, error: settingError } = await supabaseAdmin
    .from("ascend_self_check_settings")
    .select("rehearsal_code")
    .eq("id", 1)
    .maybeSingle();
  if (settingError) return json({ error: "Sending is down for a moment. Try again." }, 503);
  if (!setting?.rehearsal_code) return json({ error: "Staff have not set a rehearsal code yet. Ask a staff member." }, 403);
  if (!code || !sameCode(code, normalizeRehearsalCode(setting.rehearsal_code))) {
    return json({ error: "That rehearsal code is not right. Ask a staff member for the rehearsal code." }, 403);
  }

  // Checked after the code so someone without it cannot lock a drill number out.
  const drillRate = await checkRateLimit({ key: `ascend-check:drill:${drillNumber}`, limit: 30, windowMs: TEN_MINUTES, failOpen: false });
  if (!drillRate.allowed) return json({ error: "Too many sends. Wait a few minutes and try again." }, 429);

  const date = rehearsalDate();
  const updatedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("ascend_self_checks")
    .upsert({
      rehearsal_date: date,
      drill_number: drillNumber,
      payload,
      source: "student_self_check",
      updated_at: updatedAt,
    }, { onConflict: "rehearsal_date,drill_number" });
  if (error) {
    console.error("[ascend-check] save failed:", error.message);
    return json({ error: "Your self check could not be sent. Try again." }, 503);
  }
  return json({ ok: true, drillNumber, date, savedAt: updatedAt });
}

// Public read-only results (Rob, 2026-10-03: "we do not need to gate this"). Returns drill
// numbers, ratings, checks and notes for one day; never the rehearsal code.
export async function GET(request) {
  const rate = await checkRateLimit({ key: `ascend-check:read:${clientIp(request)}`, limit: 600, windowMs: TEN_MINUTES });
  if (!rate.allowed) return json({ error: "Too many refreshes. Wait a minute and try again." }, 429);
  try {
    return json(await loadAscendDay(request.nextUrl.searchParams.get("date")));
  } catch (error) {
    console.error("[ascend-check] public load failed:", error.message);
    return json({ error: "The self checks could not be loaded." }, 503);
  }
}
