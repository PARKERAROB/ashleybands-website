import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/portal/onboarding-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("OnboardingPrototype.jsx", root), "utf8");
const identity = readFileSync(new URL("IdentityStep.jsx", root), "utf8");
const family = readFileSync(new URL("FamilyStep.jsx", root), "utf8");
const support = readFileSync(new URL("SupportStep.jsx", root), "utf8");
const prototypeBundle = [page, client, identity, family, support].join("\n");

test("the onboarding prototype is explicitly non-saving and excluded from indexing", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Nothing is saved or sent/);
  assert.doesNotMatch(prototypeBundle, /\bfetch\s*\(/);
  assert.doesNotMatch(prototypeBundle, /supabase/i);
});

test("the prototype keeps official, guardian-owned, and private facts in their proper lanes", () => {
  assert.match(identity, /School-system record/);
  assert.match(identity, /date of birth, legal sex, and other protected details are not collected here/);
  assert.match(family, /guardians would receive a private verification request/);
  assert.match(family, /would not silently overwrite a guardian-owned email or phone number/);
  assert.match(support, /Do not enter medical diagnoses, custody details/);
});
