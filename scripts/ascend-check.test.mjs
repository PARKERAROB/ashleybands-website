import assert from "node:assert/strict";
import test from "node:test";
import {
  ASCEND_ZONES,
  aggregateAscend,
  normalizeAscendPayload,
  normalizeDrillNumber,
  rehearsalDate,
} from "../lib/ascendCheck.mjs";

test("drill numbers normalize to one letter and a number", () => {
  assert.equal(normalizeDrillNumber("T3"), "T3");
  assert.equal(normalizeDrillNumber("c2"), "C2");
  assert.equal(normalizeDrillNumber("G10"), "G10");
  assert.equal(normalizeDrillNumber(" t 03 "), "T3");
  for (const bad of ["3T", "TT3", "T100", "", "T0", "T", null]) {
    assert.throws(() => normalizeDrillNumber(bad), /drill number/, String(bad));
  }
});

test("zones match the show design: 18 zones, 1-4 through 68-73, four hits", () => {
  assert.equal(ASCEND_ZONES.length, 18);
  assert.equal(ASCEND_ZONES[0].id, "1-4");
  assert.equal(ASCEND_ZONES.at(-1).id, "68-73");
  assert.deepEqual(ASCEND_ZONES.filter((z) => z.hit).map((z) => z.id), ["15-18", "33-36", "44-47", "68-73"]);
});

test("payload keeps known values and rejects unknown zones, areas, values and long notes", () => {
  const ok = normalizeAscendPayload({ zones: {
    "1-4": { rate: { music: "red", choreo: "" }, checks: { marching: [2, 0, 0] }, note: "  late off 3 " },
    "4-7": { rate: {}, checks: {}, note: "" },
  } });
  assert.deepEqual(ok, { zones: { "1-4": { rate: { music: "red" }, checks: { marching: [0, 2] }, note: "late off 3" } } });

  const bad = [
    { zones: { "99-100": { rate: { music: "red" } } } },
    { zones: { "1-4": { rate: { dance: "red" } } } },
    { zones: { "1-4": { rate: { music: "purple" } } } },
    { zones: { "1-4": { checks: { music: [3] } } } },
    { zones: { "1-4": { checks: { music: ["0"] } } } },
    { zones: { "1-4": { rate: { music: "red" }, note: "x".repeat(301) } } },
    { zones: {} },
    { zones: [] },
    null,
  ];
  for (const payload of bad) assert.throws(() => normalizeAscendPayload(payload), JSON.stringify(payload));
});

test("rehearsal date uses the Eastern calendar day", () => {
  assert.equal(rehearsalDate(new Date("2026-10-04T02:30:00Z")), "2026-10-03");
});

test("aggregate counts and ranks a seeded set, with drill, zone and area filters", () => {
  const rows = [
    { drill_number: "T3", payload: { zones: { "1-4": { rate: { music: "red", marching: "yellow" } }, "68-73": { rate: { music: "green" } } } } },
    { drill_number: "T10", payload: { zones: { "1-4": { rate: { music: "yellow" } }, "68-73": { rate: { choreo: "red" } } } } },
    { drill_number: "C2", payload: { zones: { "4-7": { rate: { marching: "red" } } } } },
  ];
  const all = aggregateAscend(rows);
  assert.equal(all.submissions, 3);
  const z14 = all.zones.find((z) => z.id === "1-4");
  assert.deepEqual(z14.counts.music, { red: 1, yellow: 1, green: 0 });
  assert.deepEqual(z14.totals, { red: 1, yellow: 2, green: 0 });
  assert.deepEqual(all.ranked.map((z) => [z.id, z.score]), [["1-4", 4], ["4-7", 2], ["68-73", 2]]);

  const t = aggregateAscend(rows, { drill: "t" });
  assert.equal(t.submissions, 2);
  assert.equal(aggregateAscend(rows, { drill: "T1" }).submissions, 0);
  assert.equal(aggregateAscend(rows, { drill: "t 03" }).submissions, 1);

  const music = aggregateAscend(rows, { area: "music", zone: "1-4" });
  assert.deepEqual(music.zones.map((z) => z.id), ["1-4"]);
  assert.deepEqual(music.zones[0].totals, { red: 1, yellow: 1, green: 0 });
});

test("tables are RLS-locked to the service role and the public route checks the code", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");
  const sql = await read("supabase/migrations/202610030001_ascend_self_check.sql");
  for (const table of ["ascend_self_checks", "ascend_self_check_settings"]) {
    assert.match(sql, new RegExp(`alter table public.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public.${table} from anon, authenticated`));
  }
  assert.match(sql, /unique \(rehearsal_date, drill_number\)/);
  const route = await read("app/api/ascend-check/route.js");
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /onConflict: "rehearsal_date,drill_number"/);
  assert.match(await read("app/api/admin/ascend-check/route.js"), /authorizeStaffRequest\(request, STAFF_CAPABILITIES.ASCEND_CHECK_MANAGE\)/);
});
