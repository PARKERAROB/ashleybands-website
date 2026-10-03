import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { normalizeFlagDate, normalizeStaffFlag, rehearsalDate } from "@/lib/ascendCheck.mjs";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
const TEN_MINUTES = 10 * 60 * 1000;
const MAX_BODY = 8_192;
const COLUMNS = "id,zone,color,area,groups,note,name,device_hash,updated_at";

// A random per-device id from the browser. Only its hash is stored or compared.
function deviceHash(request) {
  const id = String(request.headers.get("x-ascend-device") || "");
  return /^[A-Za-z0-9-]{16,64}$/.test(id) ? createHash("sha256").update(id).digest("hex") : null;
}

// Strip the hash; tell the device which flags are its own.
const shape = (row, mine) => {
  const { device_hash: hash, ...rest } = row;
  return { ...rest, mine: Boolean(mine && hash === mine) };
};

async function writeGuard(request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Save from the Ashley Bands page." }, 403);
  const rate = await checkRateLimit({ key: `ascend-flags:write:${clientIp(request)}`, limit: 300, windowMs: TEN_MINUTES, failOpen: false });
  if (!rate.allowed) return json({ error: "Too many saves. Wait a minute and try again." }, 429);
  return null;
}

async function readBody(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new Error("That flag is too large.");
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("That flag is not valid."); }
}

export async function GET(request) {
  const rate = await checkRateLimit({ key: `ascend-flags:read:${clientIp(request)}`, limit: 1200, windowMs: TEN_MINUTES });
  if (!rate.allowed) return json({ error: "Too many refreshes. Wait a minute and try again." }, 429);
  let date;
  try { date = normalizeFlagDate(request.nextUrl.searchParams.get("date") || rehearsalDate()); } catch (error) { return json({ error: error.message }, 400); }
  const { data, error } = await supabaseAdmin.from("ascend_staff_flags").select(COLUMNS).eq("rehearsal_date", date).order("created_at");
  if (error) {
    console.error("[ascend-flags] load failed:", error.message);
    return json({ error: "Flags could not be loaded." }, 503);
  }
  const mine = deviceHash(request);
  return json({ date, flags: data.map((row) => shape(row, mine)) });
}

export async function POST(request) {
  const blocked = await writeGuard(request);
  if (blocked) return blocked;
  const mine = deviceHash(request);
  if (!mine) return json({ error: "This browser could not be identified. Reload the page." }, 400);
  let flag;
  try { flag = normalizeStaffFlag(await readBody(request)); } catch (error) { return json({ error: error.message }, 400); }
  const { data, error } = await supabaseAdmin.from("ascend_staff_flags")
    .insert({ ...flag, device_hash: mine, source: "staff_flag_page" }).select(COLUMNS).single();
  if (error) {
    console.error("[ascend-flags] insert failed:", error.message);
    return json({ error: "That flag did not save. Try again." }, 503);
  }
  return json({ flag: shape(data, mine) });
}

export async function PATCH(request) {
  const blocked = await writeGuard(request);
  if (blocked) return blocked;
  const mine = deviceHash(request);
  if (!mine) return json({ error: "This browser could not be identified. Reload the page." }, 400);
  let body;
  let flag;
  try {
    body = await readBody(request);
    if (!/^[0-9a-f-]{36}$/.test(String(body.id || ""))) throw new Error("That flag could not be found.");
    flag = normalizeStaffFlag(body);
  } catch (error) { return json({ error: error.message }, 400); }
  const { data, error } = await supabaseAdmin.from("ascend_staff_flags")
    .update({ ...flag, updated_at: new Date().toISOString() })
    .eq("id", String(body.id || "")).eq("device_hash", mine).select(COLUMNS).maybeSingle();
  if (error || !data) return json({ error: "You can only change flags you added on this device." }, error ? 503 : 404);
  return json({ flag: shape(data, mine) });
}

export async function DELETE(request) {
  const blocked = await writeGuard(request);
  if (blocked) return blocked;
  const mine = deviceHash(request);
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!mine || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "That flag could not be found." }, 400);
  const { data, error } = await supabaseAdmin.from("ascend_staff_flags").delete().eq("id", id).eq("device_hash", mine).select("id");
  if (error || !data?.length) return json({ error: "You can only delete flags you added on this device." }, error ? 503 : 404);
  return json({ ok: true });
}
