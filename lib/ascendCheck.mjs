// Ascend self check (#172). Zones, measures and letters come from the private marching
// show-design record (Show structure, Rob 2026-09-24; measures 2026-10-02). Shared by the
// public page, its submit route and the staff view, so all three agree on ids and values.

export const ASCEND_MOVEMENTS = Object.freeze([
  ["Ready For It", [["1–7", [["1-4", "1–16", "A1–A2"], ["4-7", "17–24", "B1"]]], ["7–15", [["7-10", "25–33", "B2"], ["10-15", "34–50", "C1–C2"]]], ["15–18", [["15-18", "51–65", "D", true]]]]],
  ["Fly to Paradise", [["18–28", [["18-22", "66–75", "E"], ["22-28", "76–93", "F1–F2"]]], ["28–40", [["28-33", "94–111", "F3–G"], ["33-36", "112–129", "H", true], ["36-40", "130–139", "I"]]]]],
  ["Creep", [["40–47", [["40-44", "140–155", "J–K"], ["44-47", "156–172", "L–M", true]]]]],
  ["Blow It Up, Start Again", [["47–60", [["47-54", "173–196", "N–O"], ["54-60", "197–216", "P"]]]]],
  ["Bring Me to Life", [["60–68", [["60-62", "217–224", "Q"], ["62-64", "225–232", "R"], ["64-68", "233–250", "S1–S2"]]], ["68–73", [["68-73", "251–275", "T–W", true]]]]],
]);

export const ASCEND_ZONES = Object.freeze(ASCEND_MOVEMENTS.flatMap(([title, chunks], index) =>
  chunks.flatMap(([chunk, zones]) => zones.map(([id, measures, letters, hit]) => Object.freeze({
    id,
    sets: id.replace("-", "–"),
    measures,
    letters,
    hit: Boolean(hit),
    movement: index + 1,
    movementTitle: title,
    chunk,
  })))));

const ZONE_IDS = new Set(ASCEND_ZONES.map((zone) => zone.id));

export const ASCEND_AREAS = Object.freeze({
  music: Object.freeze({ label: "Music", checks: ["I know my part from memory", "I'm locked in with the pulse", "My entrances and releases are clean"] }),
  choreo: Object.freeze({ label: "Choreo", checks: ["I know every move", "Moves land on the right count", "I match my section"] }),
  marching: Object.freeze({ label: "Marching", checks: ["I know my dot for every set", "My step size is right", "I'm in form and on interval", "Posture and horn angle hold"] }),
});
export const ASCEND_AREA_IDS = Object.freeze(Object.keys(ASCEND_AREAS));

export const RATINGS = Object.freeze(["red", "yellow", "green"]);
export const RATING_LABELS = Object.freeze({ red: "Lost", yellow: "Shaky", green: "Got it" });
export const NOTE_MAX = 300;
export const MAX_BODY_BYTES = 32_768;

const fail = (message) => { throw new Error(message); };

// One letter + 1-2 digits. Trim, uppercase, drop spaces, drop leading zeros (T03 -> T3).
export function normalizeDrillNumber(value) {
  const match = /^([A-Z])(\d{1,2})$/.exec(String(value ?? "").replace(/\s+/g, "").toUpperCase());
  const number = match ? Number(match[2]) : 0;
  if (!number) fail("Enter your drill number: one letter and a number, like T3 or G10.");
  return `${match[1]}${number}`;
}

export function normalizeRehearsalCode(value) {
  return String(value ?? "").trim().toUpperCase().slice(0, 40);
}

// Throws on anything outside the known zones, areas, ratings and check indexes.
export function normalizeAscendPayload(input) {
  const zones = input?.zones;
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) fail("Rate at least one zone before you send.");
  const out = {};
  for (const [zoneId, zone] of Object.entries(zones)) {
    if (!ZONE_IDS.has(zoneId)) fail("That self check has a zone this page does not know.");
    if (!zone || typeof zone !== "object" || Array.isArray(zone)) fail("That self check is not valid.");
    const rate = {};
    for (const [area, value] of Object.entries(zone.rate || {})) {
      if (!ASCEND_AREAS[area]) fail("That self check has an area this page does not know.");
      if (value == null || value === "") continue;
      if (!RATINGS.includes(value)) fail("Ratings must be Got it, Shaky or Lost.");
      rate[area] = value;
    }
    const checks = {};
    for (const [area, list] of Object.entries(zone.checks || {})) {
      if (!ASCEND_AREAS[area] || !Array.isArray(list)) fail("That self check has an area this page does not know.");
      const max = ASCEND_AREAS[area].checks.length;
      const picked = [...new Set(list)].sort((a, b) => a - b);
      if (picked.some((index) => !Number.isInteger(index) || index < 0 || index >= max)) fail("That self check has a checklist item this page does not know.");
      if (picked.length) checks[area] = picked;
    }
    const note = typeof zone.note === "string" ? zone.note.trim() : zone.note == null ? "" : fail("Notes must be text.");
    if (note.length > NOTE_MAX) fail(`Keep each note under ${NOTE_MAX} characters.`);
    if (Object.keys(rate).length || Object.keys(checks).length || note) out[zoneId] = { rate, checks, note };
  }
  if (!Object.keys(out).length) fail("Rate at least one zone before you send.");
  return { zones: out };
}

// Rehearsal date is the school's calendar day, not the phone's.
export function rehearsalDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

// "T" matches every T drill number; "T3" matches only T3.
export function drillMatches(drill, filter) {
  const f = String(filter || "").replace(/\s+/g, "").toUpperCase();
  if (!f) return true;
  if (/^[A-Z]$/.test(f)) return drill.startsWith(f);
  try { return drill === normalizeDrillNumber(f); } catch { return false; }
}

// rows: [{ drill_number, payload }]. Returns zones in show order with per-area counts.
export function aggregateAscend(rows, { drill = "", zone = "", area = "" } = {}) {
  const areas = area ? [area] : ASCEND_AREA_IDS;
  const picked = rows.filter((row) => drillMatches(row.drill_number, drill));
  const zones = ASCEND_ZONES.filter((z) => !zone || z.id === zone).map((z) => {
    const counts = Object.fromEntries(areas.map((a) => [a, { red: 0, yellow: 0, green: 0 }]));
    for (const row of picked) {
      const rate = row.payload?.zones?.[z.id]?.rate || {};
      for (const a of areas) if (RATINGS.includes(rate[a])) counts[a][rate[a]] += 1;
    }
    const totals = { red: 0, yellow: 0, green: 0 };
    for (const a of areas) for (const r of RATINGS) totals[r] += counts[a][r];
    return { ...z, counts, totals, score: totals.red * 2 + totals.yellow };
  });
  const ranked = zones.filter((z) => z.score > 0)
    .sort((a, b) => b.score - a.score || b.totals.red - a.totals.red);
  return { submissions: picked.length, areas, zones, ranked };
}
