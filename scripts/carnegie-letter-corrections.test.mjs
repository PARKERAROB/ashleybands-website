import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as corrections from "../lib/carnegieLetterCorrections.mjs";

// Spelling/grammar corrections and the student view for Carnegie letters (#108).
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const letter = { id: "l1", version: 3, status: "needs_review", meaning_text: "band has tought me to lisen to the peple around me", help_text: "i would love you're help" };

test("spelling, grammar and punctuation fixes pass; meaning changes are refused", () => {
  assert.equal(corrections.checkCorrection(letter.meaning_text, "Band has taught me to listen to the people around me.").ok, true);
  assert.equal(corrections.checkCorrection(letter.help_text, "I would love your help.").ok, true);
  assert.equal(corrections.checkCorrection("band is fun", "Band is terrible.").ok, false, "a new word is not a respelling");
  assert.equal(corrections.checkCorrection("I love band because of my friends", "I love band because it pays for college and trips").ok, false);
  assert.equal(corrections.checkCorrection("I love band", "").ok, false, "cannot delete an answer");
  const long = "word ".repeat(40).trim();
  assert.equal(corrections.checkCorrection(long, `${long} and more and more and more and more and more`).ok, false, "cannot pad the answer");
});

test("a correction must target the exact version waiting for review", () => {
  const ok = corrections.validateCorrection(letter, { letter_version: 3, meaning_text: "Band has taught me to listen to the people around me.", help_text: "I would love your help.", note: "spelling" });
  assert.equal(ok.letter_version, 3);
  assert.throws(() => corrections.validateCorrection(letter, { letter_version: 2, meaning_text: "x", help_text: "y" }), /letter changed/);
  assert.throws(() => corrections.validateCorrection({ ...letter, status: "approved" }, { letter_version: 3, meaning_text: "Band.", help_text: "I." }), /waiting for review/);
  assert.throws(() => corrections.validateCorrection(letter, { letter_version: 3, meaning_text: letter.meaning_text, help_text: letter.help_text }), /does not change/);
  assert.throws(() => corrections.validateCorrection(letter, { letter_version: 3, meaning_text: "Band is where I met my girlfriend.", help_text: letter.help_text }), /spelling, grammar and punctuation/);
  assert.throws(() => corrections.validateCorrection(letter, { letter_version: 3, meaning_text: "x" }), /both corrected answers/);
});

test("the original is kept and only an accepted correction for the approved version prints", () => {
  const correction = { id: "c1", status: "accepted", letter_version: 3, meaning_text: "Fixed.", help_text: "Fixed too." };
  const approved = { ...letter, status: "approved", approved_version: 3, approved_correction_id: "c1" };
  assert.deepEqual(corrections.printedWords(approved, correction), { meaning_text: "Fixed.", help_text: "Fixed too.", corrected: true });
  assert.equal(corrections.printedWords({ ...approved, approved_correction_id: null }, correction).corrected, false);
  assert.equal(corrections.printedWords({ ...approved, version: 4 }, correction).corrected, false, "a later version never prints an old correction");
  assert.equal(corrections.printedWords(approved, { ...correction, status: "suggested" }).corrected, false);
  assert.equal(corrections.printedWords(approved, null).meaning_text, letter.meaning_text);
  const diff = corrections.wordDiff("i love band", "I love band.");
  assert.deepEqual(diff.map((part) => part.kind), ["removed", "added", "same", "removed", "added"]);
});

test("the database keeps originals, ties corrections to a version and lets only staff accept", () => {
  const migration = read("supabase/migrations/202609250001_carnegie_letter_corrections.sql");
  assert.doesNotMatch(migration, /update public\.carnegie_student_letters\s+set[^;]*(meaning_text|help_text)/i, "never rewrites the student's words");
  assert.match(migration, /A reviewed correction is final/);
  assert.match(migration, /A correction cannot be rewritten; propose a new one/);
  assert.match(migration, /must be accepted and match this letter version/);
  assert.match(migration, /create trigger carnegie_student_letter_zz_correction_matches/, "runs after the letter guard");
  assert.match(migration, /revoke all privileges on table public\.carnegie_letter_corrections from anon, authenticated;/);
  assert.match(migration, /revoke all on function public\.approve_carnegie_letter_with_correction\(uuid, integer, uuid, uuid\) from public, anon, authenticated;/);
  assert.match(migration, /source text not null check \(source in \('atlas', 'staff'\)\)/);
  assert.match(migration, /proposed_by text not null/);
});

test("Atlas's script suggests and never approves", () => {
  const script = read("scripts/carnegie-letter-corrections.mjs");
  assert.match(script, /source: ATLAS, proposed_by: ATLAS/);
  assert.match(script, /validateCorrection\(letter/);
  assert.doesNotMatch(script, /approve_carnegie_letter|status: "approved"|"approved"|carnegie_student_letters\?[^"`]*,\s*\{\s*method: "PATCH"/);
  assert.doesNotMatch(script, /method: "PATCH"|method: "DELETE"/, "the script only reads letters and inserts suggestions");
  assert.match(script, /action: "letter\.correction_suggested"/, "audited");
});

test("a signed-in student sees only their own notes, letters and builder", () => {
  const server = read("lib/carnegieLettersServer.js");
  assert.match(server, /isStudent \? new Map\(\) : depositPaidCents\(ids\)/, "no deposit for students");
  assert.match(server, /isStudent \? \[\] : reportsForStudents\(ids\)/, "no reported gifts for students");
  assert.match(server, /depositPaidCents: isStudent \? null/);
  assert.match(server, /if \(await portalViewer\(personId\) === "student"\) return \{ status: 403/, "students cannot report money");
  assert.match(read("lib/billing.js"), /if \(person\?\.person_type === "student"\) return row\.assurance_level === "high";/, "students reach only their own verified link");
  const client = read("app/portal/carnegie-notes/CarnegieNotesClient.jsx");
  assert.match(client, /\{viewer === "student" \? null : <ReportGift/);
  assert.match(client, /student\.depositPaidCents === null \? null/);
  for (const file of ["app/portal/carnegie-notes/CarnegieNotesClient.jsx", "app/portal/carnegie-notes/letter/LetterBuilderClient.jsx"]) {
    assert.doesNotMatch(read(file), /guardian|contact_methods|\/api\/portal\/me|billing/i, `${file} shows no family contacts or billing`);
  }
});
