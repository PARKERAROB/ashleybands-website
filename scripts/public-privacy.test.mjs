// Public privacy guardrail (#133). Everything under public/ is served to anyone, and
// everything under content/ ships in the public repo. Neither may hold roster-shaped student
// data: records that pair a person's name with grade, instrument, room, bus or part; long
// lists of personal names; or student school email addresses.
//
// If this test fails, move the data behind a staff-gated route or out of the repo. Do not
// widen the allowlist unless the file is intentionally public, and say why next to the entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_DIRS = [
  { dir: "public", extensions: [".html", ".js", ".json", ".txt", ".csv"] },
  { dir: "content", extensions: [".json"] }
];

// Minimum repeats before a pattern counts as a roster.
const RECORD_THRESHOLD = 5;
const NAME_LIST_THRESHOLD = 8;
const PEOPLE_THRESHOLD = 12;

// Files that may trip a specific detector, with the reason. Paths are repo-relative with "/".
// Shape: { "public/x.html": { detectors: ["name-list"], reason: "why this is safe to publish" } }
// Empty on purpose: every file under public/ and content/ passes today (2026-09-26), including
// the sponsor lists, the NC MPA results data and the band camp handbook. The spring concert
// program (public/programs/spring-concert-2026/index.html) names seniors in page text, which these
// detectors do not target; whether it stays up is an open question for Mr. Parker.
export const ALLOWLIST = {};

const NAME_KEYS = ["name", "first", "last", "firstname", "lastname", "first_name", "last_name", "student", "studentname", "student_name", "fullname", "full_name"];
const ROSTER_KEYS = ["grade", "instrument", "room", "bus", "part", "seat", "chair"];

const KEY_PATTERN = /["']?([A-Za-z_]+)["']?\s*:/g;
const STUDENT_EMAIL = /[A-Za-z0-9._%+-]+@student\.nhcs\.net/gi;
const LAST_FIRST = /^[A-Z][a-z]+(?:[-'][A-Z][a-z]+)?, [A-Z][a-z]+(?: [A-Z]\.?)?$/;
const FIRST_LAST = /^[A-Z][a-z]+ (?:[A-Z][a-z]*[-'])?[A-Z][a-z]+(?:-[A-Z][a-z]+)?$/;

function keysIn(text) {
  const keys = new Set();
  for (const match of text.matchAll(KEY_PATTERN)) keys.add(match[1].toLowerCase());
  return keys;
}

// Object literals (JS or JSON) that pair a name-like key with a roster key.
function countRosterRecords(text) {
  let count = 0;
  for (const match of text.matchAll(/\{[^{}]{0,800}\}/g)) {
    const keys = keysIn(match[0]);
    if (NAME_KEYS.some((key) => keys.has(key)) && ROSTER_KEYS.some((key) => keys.has(key))) count += 1;
  }
  return count;
}

// CSV with a name column beside a roster column.
function countCsvRosterRows(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return 0;
  const header = lines[0].split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));
  const hasName = header.some((cell) => NAME_KEYS.includes(cell));
  const hasRoster = header.some((cell) => ROSTER_KEYS.includes(cell));
  return hasName && hasRoster ? lines.length - 1 : 0;
}

// Largest count of distinct person-name strings inside a single array literal. Title Case
// phrases ("Spring Concert") look like names too, so an array only counts when name-shaped
// strings are at least half of its distinct strings, as they are in a list of riders or rooms.
function largestNameList(text) {
  let largest = 0;
  for (const match of text.matchAll(/\[([^[\]]{0,200000})\]/g)) {
    const strings = new Set([...match[1].matchAll(/(["'`])((?:(?!\1)[^\\\n]){3,60})\1/g)].map((m) => m[2].trim()));
    const names = [...strings].filter((value) => LAST_FIRST.test(value) || FIRST_LAST.test(value));
    if (strings.size && names.length / strings.size >= 0.5) largest = Math.max(largest, names.length);
  }
  return largest;
}

// Object literals whose name-like key holds a person's name, e.g. hotel room occupants
// ({ name: "First Last", role: "student" }) even without a grade or room key beside it.
function countNamedPeople(text) {
  let count = 0;
  const pattern = new RegExp(`["']?(?:${NAME_KEYS.join("|")})["']?\\s*:\\s*(["'\`])([^"'\`\\n]{3,60})\\1`, "gi");
  for (const match of text.matchAll(pattern)) {
    const value = match[2].trim();
    if (LAST_FIRST.test(value) || FIRST_LAST.test(value)) count += 1;
  }
  return count;
}

// Short one-line tuples that start with a person's name, e.g. ["First Last", "Bus 2", "student"]
// or ["First", "Last", "10"].
const SINGLE_WORD = /^[A-Z][a-z]+(?:-[A-Z][a-z]+)?$/;
function countNameTuples(text) {
  let count = 0;
  for (const match of text.matchAll(/\[([^[\]{}\n]{3,240})\]/g)) {
    const strings = [...match[1].matchAll(/(["'])((?:(?!\1)[^\\\n]){1,60})\1/g)].map((m) => m[2].trim());
    if (strings.length < 2 || strings.length > 8) continue;
    const [first, second] = strings;
    if (LAST_FIRST.test(first) || FIRST_LAST.test(first) || (SINGLE_WORD.test(first) && SINGLE_WORD.test(second))) count += 1;
  }
  return count;
}

export function scanText(text, extension) {
  const findings = [];
  const emails = text.match(STUDENT_EMAIL) || [];
  if (emails.length) findings.push({ detector: "student-email", detail: `${emails.length} @student.nhcs.net address(es)` });
  const records = countRosterRecords(text) + (extension === ".csv" ? countCsvRosterRows(text) : 0);
  if (records >= RECORD_THRESHOLD) findings.push({ detector: "roster-records", detail: `${records} name + grade/instrument/room/bus/part records` });
  const people = countNamedPeople(text);
  if (people >= PEOPLE_THRESHOLD) findings.push({ detector: "named-people", detail: `${people} records with a person's name in a name field` });
  const tuples = countNameTuples(text);
  if (tuples >= PEOPLE_THRESHOLD) findings.push({ detector: "name-tuples", detail: `${tuples} short arrays that start with a person's name` });
  const names = largestNameList(text);
  if (names >= NAME_LIST_THRESHOLD) findings.push({ detector: "name-list", detail: `array literal with ${names} person-name strings` });
  return findings;
}

function walk(dir, extensions) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, extensions));
    else if (extensions.some((extension) => entry.name.toLowerCase().endsWith(extension))) files.push(full);
  }
  return files;
}

export function scanTree(base, { allowlist = ALLOWLIST } = {}) {
  const problems = [];
  for (const { dir, extensions } of SCAN_DIRS) {
    for (const file of walk(join(base, dir), extensions)) {
      const rel = relative(base, file).split(sep).join("/");
      const extension = rel.slice(rel.lastIndexOf(".")).toLowerCase();
      const allowed = allowlist[rel]?.detectors || [];
      for (const finding of scanText(readFileSync(file, "utf8"), extension)) {
        // Student emails are never allowlisted.
        if (finding.detector !== "student-email" && allowed.includes(finding.detector)) continue;
        problems.push(`${rel}: ${finding.detector} (${finding.detail})`);
      }
    }
  }
  return problems;
}

test("public/ and content/ hold no roster-shaped student data", () => {
  const problems = scanTree(root);
  assert.deepEqual(problems, [], `Roster-shaped data found:\n${problems.join("\n")}`);
});

test("every allowlist entry exists, has a reason, and is still needed", () => {
  const unfiltered = scanTree(root, { allowlist: {} });
  for (const [path, entry] of Object.entries(ALLOWLIST)) {
    assert.ok(existsSync(join(root, path)), `allowlisted file is gone; remove it from ALLOWLIST: ${path}`);
    assert.ok(entry.reason && entry.reason.length > 20, `${path} needs a reason`);
    for (const detector of entry.detectors) {
      assert.ok(unfiltered.some((line) => line.startsWith(`${path}: ${detector}`)), `${path} no longer trips ${detector}; remove it from ALLOWLIST`);
    }
  }
});

test("the guardrail catches planted roster fixtures", () => {
  const base = mkdtempSync(join(tmpdir(), "privacy-guardrail-"));
  try {
    mkdirSync(join(base, "public", "trip"), { recursive: true });
    mkdirSync(join(base, "content"), { recursive: true });
    const people = ["Avery", "Blake", "Casey", "Drew", "Emery", "Finley", "Harper", "Jordan", "Kendall", "Logan"];
    const surnames = ["Stone", "Rivers", "Hollis", "Marsh", "Keller", "Dalton", "Prescott", "Warren", "Easton", "Monroe"];
    // Invented placeholder names only.
    const rooms = people.map((first, index) => ({ name: `${first} ${surnames[index]}`, grade: 10, room: index }));
    writeFileSync(join(base, "public", "trip", "rooms.html"), `<script>const rooms = ${JSON.stringify(rooms)};</script>`);
    writeFileSync(join(base, "public", "trip", "riders.js"), `const riders = [${people.map((first, index) => `"${surnames[index]}, ${first}"`).join(", ")}];`);
    writeFileSync(join(base, "public", "trip", "list.csv"), `first_name,last_name,instrument\n${people.map((first, index) => `${first},${surnames[index]},Flute`).join("\n")}\n`);
    const occupants = people.concat(people).map((first, index) => ({ name: `${first} ${surnames[index % 10]}`, role: "student" }));
    writeFileSync(join(base, "public", "trip", "hotel.html"), `<script>const occupants = ${JSON.stringify(occupants)};</script>`);
    const tuples = people.concat(people).map((first, index) => `["${first} ${surnames[index % 10]}", "Bus ${index % 2}", "student"]`);
    writeFileSync(join(base, "public", "trip", "bus.js"), `const riders = [\n${tuples.join(",\n")}\n];`);
    writeFileSync(join(base, "content", "contacts.json"), JSON.stringify({ note: "test", email: "placeholder.person@student.nhcs.net" }));
    writeFileSync(join(base, "public", "safe.json"), JSON.stringify({ title: "Concert Band", items: ["Spring Concert", "Winter Concert"] }));

    const problems = scanTree(base, { allowlist: {} });
    const hit = (file, detector) => problems.some((line) => line.startsWith(`${file}: ${detector}`));
    assert.ok(hit("public/trip/rooms.html", "roster-records"), problems.join("\n"));
    assert.ok(hit("public/trip/riders.js", "name-list"), problems.join("\n"));
    assert.ok(hit("public/trip/list.csv", "roster-records"), problems.join("\n"));
    assert.ok(hit("content/contacts.json", "student-email"), problems.join("\n"));
    assert.ok(hit("public/trip/hotel.html", "named-people"), problems.join("\n"));
    assert.ok(hit("public/trip/bus.js", "name-tuples"), problems.join("\n"));
    assert.ok(!problems.some((line) => line.startsWith("public/safe.json")), problems.join("\n"));

    // An allowlist entry never excuses a student email.
    const allowAll = { "content/contacts.json": { detectors: ["student-email", "roster-records", "name-list"], reason: "fixture" } };
    assert.ok(scanTree(base, { allowlist: allowAll }).some((line) => line.startsWith("content/contacts.json: student-email")));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
