import assert from "node:assert/strict";
import test from "node:test";
import { countMarchers, fillCounts, parseCsv } from "./lib/roster-counts.mjs";

const csv = 'id,status,notes,mb_role_2026\na,active,"plays, ""bells""",Percussion\nb,active,"line\nbreak",\nc,inactive-dropped,,Color Guard\nd,active,,Trumpet\n';

test("counts active students with a marching role, handling quoted commas and newlines", () => {
  assert.equal(parseCsv(csv).length, 5);
  assert.equal(countMarchers(csv), 2);
});

test("fills marcher tokens from the count", () => {
  const out = fillCounts("{{marchers}} march; goal {{marchers*500}}; {{marchers*5}} contacts; {{per:42000}} each", { marchers2026: 60 });
  assert.equal(out, "60 march; goal $30,000; 300 contacts; $700 each");
  assert.doesNotMatch(fillCounts("{{marchers}}", { marchers2026: 59 }), /60/);
});
