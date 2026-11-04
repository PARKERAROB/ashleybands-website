import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { PERIODS, TRIOS_SLUG, validatePick } from "@/lib/holidayTrios.mjs";

// Holiday trio picks (#255). No sign-in: the unlisted slug is the gate. Fixed choice lists,
// first name and last initial only, one pick per name per period (saving again replaces it).
// A whole class shares one school network, so the per-network budget is generous.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const notFound = () => Response.json({ error: "Not found" }, { status: 404, headers });

async function listPicks(period) {
  const { data, error } = await supabaseAdmin
    .from("trio_picks")
    .select("student_name, instrument, piece, part, updated_at")
    .eq("period", period)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => ({ name: row.student_name, instrument: row.instrument, piece: row.piece, part: row.part }));
}

export async function GET(request, { params }) {
  const { slug } = await params;
  if (slug !== TRIOS_SLUG) return notFound();
  const period = new URL(request.url).searchParams.get("period");
  if (!PERIODS.some((p) => p.id === period)) return Response.json({ error: "Choose a class period." }, { status: 400, headers });
  try {
    return Response.json({ period, picks: await listPicks(period) }, { headers });
  } catch {
    return Response.json({ error: "The list did not load. Try again." }, { status: 502, headers });
  }
}

export async function POST(request, { params }) {
  const { slug } = await params;
  if (slug !== TRIOS_SLUG) return notFound();

  const windowMs = 15 * 60 * 1000;
  const network = await checkRateLimit({ key: `trio-picks:${clientIp(request)}`, limit: 300, windowMs, failOpen: false });
  const overall = network.allowed && await checkRateLimit({ key: "trio-picks:global", limit: 900, windowMs, failOpen: false });
  if (!network.allowed || !overall?.allowed) return Response.json({ error: "Too many saves right now. Wait a minute and try again." }, { status: 429, headers });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Something went wrong. Try again." }, { status: 400, headers }); }
  const { pick, error } = validatePick(body);
  if (error) return Response.json({ error }, { status: 400, headers });

  const { error: saveError } = await supabaseAdmin.from("trio_picks").upsert({
    period: pick.period,
    student_name: pick.name,
    name_key: pick.name.toLowerCase(),
    instrument: pick.instrument,
    piece: pick.piece,
    part: pick.part,
    source: "trio-picker",
    updated_at: new Date().toISOString()
  }, { onConflict: "period,name_key" });
  if (saveError) return Response.json({ error: "Your pick did not save. Try again." }, { status: 502, headers });

  try {
    return Response.json({ saved: pick, picks: await listPicks(pick.period) }, { headers });
  } catch {
    return Response.json({ saved: pick, picks: null }, { headers });
  }
}
