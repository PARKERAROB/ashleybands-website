import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/portal/onboarding-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("OnboardingPrototype.jsx", root), "utf8");
const identity = readFileSync(new URL("IdentityStep.jsx", root), "utf8");
const contact = readFileSync(new URL("ContactStep.jsx", root), "utf8");
const family = readFileSync(new URL("FamilyStep.jsx", root), "utf8");
const music = readFileSync(new URL("MusicStep.jsx", root), "utf8");
const support = readFileSync(new URL("SupportStep.jsx", root), "utf8");
const prototypeBundle = [page, client, identity, contact, family, music, support].join("\n");

test("the onboarding prototype is explicitly non-saving and excluded from indexing", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Nothing is saved or sent/);
  assert.doesNotMatch(prototypeBundle, /\bfetch\s*\(/);
  assert.doesNotMatch(prototypeBundle, /supabase/i);
});

test("the prototype collects facts without inventing student communication permission", () => {
  assert.match(identity, /School-system record/);
  assert.match(identity, /What should we call you\? \(optional\)/);
  assert.match(contact, /Emergency use\./);
  assert.doesNotMatch(contact, /Best way to contact|may text|textOkay|preferredContact/);
  assert.match(family, /Primary \+ emergency/);
  assert.match(family, /form\.guardianCount < 4/);
  assert.match(music, /"None"/);
  assert.match(music, /"Guitar", "Bass Guitar", "Piano"/);
  assert.doesNotMatch(music, /International School at Gregory/);
  assert.doesNotMatch(prototypeBundle, /colorGuardOnly|color_guard/);
  assert.match(music, /otherInstruments\.includes/);
  assert.match(music, /Outside New Hanover County/);
  assert.match(support, /I am a percussionist/);
  assert.match(support, /No medical or custody details/);
});
