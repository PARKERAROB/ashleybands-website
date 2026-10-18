import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIELDS, cleanAnswers, resolveSelfStudent, staffRows, scriptEntry } from "../lib/seniorNight.mjs";

const answers = { announcedName: "Example  Student", pronunciation: "ex-AM-pul", section: "trumpet", escorts: "escorted by her parents", plans: "UNCW, music education", favoriteMoment: "Finals at Corinth Holders" };
const student = { id: "synthetic", display_name: "Example Student", status: "active", grade_fall26: "12th Grade", marching_2026: "Yes" };
const link = { role: "student", relationship_status: "trusted", student };

test("answers are trimmed, required, bounded and closed to unknown keys", () => {
  assert.equal(cleanAnswers(answers).announcedName, "Example Student");
  assert.equal(cleanAnswers({ ...answers, pronunciation: "" }).pronunciation, "");
  for (const field of FIELDS.filter((f) => f.required)) assert.equal(cleanAnswers({ ...answers, [field.id]: "  " }), null);
  for (const field of FIELDS) assert.equal(cleanAnswers({ ...answers, [field.id]: "x".repeat(field.max + 1) }), null);
  assert.equal(cleanAnswers({ ...answers, studentId: "someone-else" }), null);
  assert.equal(cleanAnswers({ ...answers, section: 7 }), null);
  assert.equal(cleanAnswers([]), null);
});

test("only an unambiguous trusted senior's own account is eligible", () => {
  assert.equal(resolveSelfStudent({ person_type: "student" }, [link]), student);
  assert.equal(resolveSelfStudent({ person_type: "guardian" }, [link]), null);
  assert.equal(resolveSelfStudent({ person_type: "student" }, [{ ...link, relationship_status: "claimed" }]), null);
  assert.equal(resolveSelfStudent({ person_type: "student" }, [link, link]), null);
  for (const patch of [{ status: "inactive" }, { grade_fall26: "11th Grade" }]) assert.equal(resolveSelfStudent({ person_type: "student" }, [{ ...link, student: { ...student, ...patch } }]), null);
});

test("staff list keeps nonresponders, drops non-seniors and foreign responses, answered first", () => {
  const rows = staffRows([{ ...student, id: "b", display_name: "Zed" }, student, { ...student, id: "junior", grade_fall26: "11th Grade" }], [{ student_id: "synthetic", answers, updated_at: "2026-10-18" }, { student_id: "foreign", answers }]);
  assert.deepEqual(rows.map((r) => r.studentId), ["synthetic", "b"]);
  assert.equal(rows[1].answers, null);
});

test("script entry reads cleanly and marks pronunciation as a note", () => {
  assert.equal(scriptEntry(cleanAnswers(answers)), "Example Student [say: ex-AM-pul], trumpet. Escorted by her parents. After graduation: UNCW, music education. Favorite band moment: Finals at Corinth Holders.");
  assert.ok(!scriptEntry(cleanAnswers({ ...answers, pronunciation: "" })).includes("[say"));
});

test("storage and routes keep privacy and self-only editing", () => {
  const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
  const sql = read("supabase/migrations/202610180001_senior_night_responses.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all.*anon, authenticated/);
  assert.match(sql, /primary key \(event_key, student_id\)/);
  const route = read("app/api/portal/senior-night/route.js");
  assert.match(route, /student_id: identity.student.id/);
  assert.match(route, /headers.get\("origin"\)/);
  assert.match(route, /Object.keys\(body\).length === 1/);
  const admin = read("app/api/admin/senior-night/route.js");
  assert.match(admin, /SENIOR_NIGHT_READ/);
  assert.match(admin, /logAudit/);
});
