// Band room board block choice (#154). Times are America/New_York; Sep 28 2026 is a Monday (EDT, UTC-4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectBlock, nextOnOrAfter } from "../lib/classroomBoard.mjs";

const at = (iso) => new Date(`${iso}-04:00`);

test("in session shows that block", () => {
  assert.equal(selectBlock(at("2026-09-28T08:30")), "concert");
  assert.equal(selectBlock(at("2026-09-28T10:02")), "concert");
  assert.equal(selectBlock(at("2026-09-28T10:30")), "percussion");
  assert.equal(selectBlock(at("2026-09-28T14:10")), "wind");
  assert.equal(selectBlock(at("2026-09-28T15:29")), "wind");
});

test("between blocks shows the next one", () => {
  assert.equal(selectBlock(at("2026-09-28T10:05")), "percussion");
  assert.equal(selectBlock(at("2026-09-28T11:50")), "wind");
  assert.equal(selectBlock(at("2026-09-28T13:00")), "wind");
});

test("outside school shows 1st block", () => {
  assert.equal(selectBlock(at("2026-09-28T06:45")), "concert");
  assert.equal(selectBlock(at("2026-09-28T15:30")), "concert");
  assert.equal(selectBlock(at("2026-09-28T21:00")), "concert");
  assert.equal(selectBlock(at("2026-10-03T10:30")), "concert");
  assert.equal(selectBlock(at("2026-10-04T14:00")), "concert");
});

test("uses school time, not the machine zone", () => {
  // 14:10 UTC is 10:10 in New York.
  assert.equal(selectBlock(new Date("2026-09-28T14:10:00Z")), "percussion");
});

test("next dated item is on or after today", () => {
  const items = [{ date: "2026-10-05" }, { date: "2026-09-28" }, { date: "2026-09-21" }];
  assert.equal(nextOnOrAfter(items, "2026-09-28").date, "2026-09-28");
  assert.equal(nextOnOrAfter(items, "2026-09-29").date, "2026-10-05");
  assert.equal(nextOnOrAfter(items, "2026-10-06"), null);
});

test("board data has every class and no em dashes", () => {
  const raw = readFileSync(new URL("../content/sources/classroom-board.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);
  assert.ok(!raw.includes("—"), "no em dashes");
  assert.match(data.slug, /^[a-z0-9]{10,}$/);
  for (const id of ["concert", "percussion", "wind"]) {
    assert.ok(data.classes[id], id);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
      const plan = data.classes[id].plans[day];
      assert.ok(Array.isArray(plan.fundamentals) && Array.isArray(plan.rehearsal), `${id} ${day} plan shape`);
    }
  }
  assert.equal(data.week.length, 5);
});
