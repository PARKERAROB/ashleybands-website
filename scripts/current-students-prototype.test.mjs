import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/admin/current-students-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("CurrentStudentsPrototype.jsx", root), "utf8");
const logic = readFileSync(new URL("current-students-prototype.logic.mjs", root), "utf8");
const bundle = `${page}\n${client}\n${logic}`;
const { compareStudents, emailValuesForStudents, needDescription } = await import(new URL("current-students-prototype.logic.mjs", root));

test("the staff roster prototype is synthetic, read-only, and excluded from indexing", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Prototype · Synthetic data/);
  assert.match(client, /Nothing is saved or sent/);
  assert.doesNotMatch(bundle, /\bfetch\s*\(|supabase/i);
});

test("current students are the default and inactive students require an intentional view", () => {
  assert.match(client, /useState\(initialStudent\?\.status \|\| "active"\)/);
  assert.match(client, /student\.status === view/);
  assert.match(client, /Inactive Students/);
  assert.match(client, /Current Students/);
});

test("the prototype separates roster placement from student music background", () => {
  assert.match(client, /programInstrument/);
  assert.match(client, /primaryInstrument/);
  assert.match(client, /Program instrument/);
  assert.match(client, /Music background/);
});

test("pronouns appear in student detail rather than the roster columns", () => {
  assert.match(client, /Pronouns · \{student\.pronouns\}/);
  assert.doesNotMatch(client, /<th>Pronouns<\/th>/);
  assert.match(client, /focusedId\s*\?/);
});

test("the roster supports combined filtering, sorting, and list actions", () => {
  assert.match(client, /Filters combine/);
  assert.match(client, /Program instrument/);
  assert.match(client, /Open need/);
  assert.match(client, /useState\("last-asc"\)/);
  assert.match(client, /Last name · A–Z/);
  assert.match(client, /Grade · 9–12/);
  assert.match(client, /Ensemble · A–Z/);
  assert.match(client, /Guardian emails/);
  assert.match(client, /Student \+ guardian/);
  assert.match(client, /School email,Personal email,Student mobile,Guardian,Guardian email,Guardian phone/);
  assert.match(client, /Export contacts/);
  assert.match(client, /ensembles-memberships-prototype\?student=/);
});

test("open needs identify the missing follow-up instead of showing only a count", () => {
  assert.match(logic, /Equipment assignment needed/);
  assert.equal(needDescription({ forms: [4, 5] }, "Form"), "1 form missing");
  assert.match(client, /student\.needs\.map/);
});

test("sort choices order the same roster without changing its membership", () => {
  const students = [
    { displayName: "Zoey Alpha", legalName: "Zoey Marie Alpha", grade: "11", ensembles: ["Wind Ensemble"], programInstrument: "Trumpet", needs: [] },
    { displayName: "Avery Zulu", legalName: "Avery Lee Zulu", grade: "9", ensembles: ["Concert Band"], programInstrument: "Clarinet", needs: ["Form"] }
  ];
  assert.deepEqual([...students].sort((a, b) => compareStudents(a, b, "last-asc")).map((student) => student.displayName), ["Zoey Alpha", "Avery Zulu"]);
  assert.deepEqual([...students].sort((a, b) => compareStudents(a, b, "first-asc")).map((student) => student.displayName), ["Avery Zulu", "Zoey Alpha"]);
  assert.deepEqual([...students].sort((a, b) => compareStudents(a, b, "grade-asc")).map((student) => student.grade), ["9", "11"]);
  assert.deepEqual([...students].sort((a, b) => compareStudents(a, b, "ensemble-asc")).map((student) => student.ensembles[0]), ["Concert Band", "Wind Ensemble"]);
  assert.deepEqual([...students].sort((a, b) => compareStudents(a, b, "needs-desc")).map((student) => student.needs.length), [1, 0]);
});

test("combined email lists include both axes once", () => {
  const students = [
    { schoolEmail: "student.one@example.com", guardian: { email: "family@example.com" } },
    { schoolEmail: "student.two@example.com", guardian: { email: "family@example.com" } }
  ];
  assert.deepEqual(emailValuesForStudents(students, "both"), ["student.one@example.com", "family@example.com", "student.two@example.com"]);
});
