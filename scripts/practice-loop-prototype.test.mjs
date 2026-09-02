import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  BERNSTEIN_LAST_MEASURE,
  BERNSTEIN_LARGE_CHANGES,
  BERNSTEIN_REHEARSAL_STARTS,
  aggregatePracticeRanges,
  bernsteinRanges,
  normalizePracticeDisplayName,
  normalizePracticeSubmission,
  rankPracticeRanges,
} from "../lib/practiceLoop.mjs";

test("rehearsal ranges preserve the supplied boundaries through measure 312", () => {
  const ranges = bernsteinRanges();
  assert.deepEqual(ranges.map(({ start }) => start), BERNSTEIN_REHEARSAL_STARTS);
  assert.equal(ranges.at(-1).end, BERNSTEIN_LAST_MEASURE);
  ranges.slice(0, -1).forEach((range, index) => {
    assert.equal(range.end + 1, ranges[index + 1].start);
  });
});

test("aggregate ranges score marked responses and keep unmarked coverage visible", () => {
  const aggregate = aggregatePracticeRanges([
    { marks: { 1: "red", 8: "green" } },
    { marks: { 1: "yellow", 8: "green" } },
    { marks: {} },
  ]);
  const first = aggregate.find(({ start }) => start === 1);
  const eighth = aggregate.find(({ start }) => start === 8);
  const fifteenth = aggregate.find(({ start }) => start === 15);

  assert.deepEqual(
    { red: first.red, yellow: first.yellow, green: first.green, unmarked: first.unmarked, responses: first.responseCount, concern: first.concernPercent },
    { red: 1, yellow: 1, green: 0, unmarked: 1, responses: 2, concern: 75 },
  );
  assert.equal(eighth.concernPercent, 0);
  assert.equal(eighth.unmarked, 1);
  assert.equal(fifteenth.concernPercent, null);
  assert.equal(fifteenth.unmarked, 3);
});

test("aggregate priority ranks concern first and leaves unassessed ranges last", () => {
  const ranked = rankPracticeRanges(aggregatePracticeRanges([
    { marks: { 1: "yellow", 8: "red", 15: "green" } },
  ]));
  assert.deepEqual(ranked.slice(0, 3).map(({ start }) => start), [8, 1, 15]);
  assert.equal(ranked.at(-1).concernPercent, null);
});

test("staff rename normalization uses the same student-name rules", () => {
  assert.equal(normalizePracticeDisplayName("  Student   Example "), "Student Example");
  assert.throws(() => normalizePracticeDisplayName("A"), /student name/i);
});

test("only the director-identified large musical changes are dividers", () => {
  assert.deepEqual(
    bernsteinRanges().filter(({ largeChange }) => largeChange).map(({ start }) => start),
    BERNSTEIN_LARGE_CHANGES,
  );
  assert.equal(bernsteinRanges().find(({ start }) => start === 243).largeChange, false);
});

test("submission normalization keeps only recognized marks", () => {
  const result = normalizePracticeSubmission({
    participantToken: "123e4567-e89b-42d3-a456-426614174000",
    displayName: "  Student   Example ",
    instrument: "Clarinet",
    marks: { 1: "green", 8: "yellow", 999: "red", 15: "purple" },
  });
  assert.equal(result.displayName, "Student Example");
  assert.deepEqual(result.marks, { 1: "green", 8: "yellow" });
});

test("submission normalization rejects missing identity and invalid browser keys", () => {
  assert.throws(() => normalizePracticeSubmission({}), /practice key/i);
  assert.throws(() => normalizePracticeSubmission({
    participantToken: "123e4567-e89b-42d3-a456-426614174000",
    displayName: "A",
    instrument: "Clarinet",
  }), /name/i);
});

test("prototype storage is private and dashboard reads are authorized and audited", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202609020001_practice_loop_prototype.sql", import.meta.url), "utf8");
  const studentRoute = await readFile(new URL("../app/api/practice-loop/bernstein-tribute/route.js", import.meta.url), "utf8");
  const dashboardRoute = await readFile(new URL("../app/api/admin/practice-loop/route.js", import.meta.url), "utf8");
  const dashboardClient = await readFile(new URL("../app/admin/practice-loop/PracticeLoopDashboard.jsx", import.meta.url), "utf8");
  const managementMigration = await readFile(new URL("../supabase/migrations/202609020002_practice_loop_student_management.sql", import.meta.url), "utf8");

  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all[^;]+anon, authenticated/i);
  assert.doesNotMatch(studentRoute, /export async function GET/);
  assert.match(studentRoute, /failOpen:\s*false/);
  assert.match(dashboardRoute, /SYSTEM_OVERSIGHT_READ/);
  assert.match(dashboardRoute, /logAuditRequired/);
  assert.match(dashboardRoute, /PRACTICE_LOOP_MANAGE/);
  assert.match(dashboardRoute, /manage_practice_loop_submission_with_audit/);
  assert.match(dashboardRoute, /\.is\("removed_at", null\)/);
  assert.doesNotMatch(dashboardRoute, /participant_token_hash/);
  assert.doesNotMatch(dashboardClient, /status\[0\]\.toUpperCase/);
  assert.doesNotMatch(dashboardClient, /className="sr-only">\{LABELS\[status\]/);
  assert.match(dashboardClient, /aria-label=\{LABELS\[status\] \|\| "Unmarked"\}/);
  assert.match(managementMigration, /security definer/i);
  assert.match(managementMigration, /insert into (?:public\.)?audit_log/i);
  assert.match(managementMigration, /removed_at/i);
  assert.match(managementMigration, /revoke all on function[^;]+public, anon, authenticated/is);
});
