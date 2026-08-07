import test from "node:test";
import assert from "node:assert/strict";

import { computeSize, lengthClassFor } from "../lib/uniformSizing.js";

test("uses the largest chest, waist, or hip size instead of the average", () => {
  const result = computeSize(
    { chest_in: 31, waist_in: 45, hips_in: 34, height: "5-10" },
    { mbRole: "Percussion" }
  );
  assert.deepEqual(result.per, { chest: "3xS", waist: "2xL", hip: "XS" });
  assert.equal(result.size, "2xL");
});

test("floors Classic Tops at Small", () => {
  const result = computeSize(
    { chest_in: 31, waist_in: 27, hips_in: 29, height: "5-4" },
    { mbRole: "Clarinet" }
  );
  assert.equal(result.size, "S");
  assert.equal(result.sizes[0], "S");
  assert.equal(result.lengthClass, "REGULAR");
});

test("allows the named XS exception through the caller-provided minimum", () => {
  const result = computeSize(
    { chest_in: 34, waist_in: 31, hips_in: 34, height: "5-5" },
    { mbRole: "Percussion", minimumSize: "XS" }
  );
  assert.equal(result.size, "XS");
  assert.equal(result.sizes[0], "XS");
});

test("floors unitards at Small as well", () => {
  const result = computeSize(
    { chest_in: 23, waist_in: 21, hips_in: 27 },
    { mbRole: "Color Guard" }
  );
  assert.equal(result.size, "S");
  assert.equal(result.sizes[0], "S");
});

test("uses only Regular and Tall length classes", () => {
  assert.deepEqual(lengthClassFor("5-2"), { lengthClass: "REGULAR", heightInches: 62, unparsedHeight: false });
  assert.deepEqual(lengthClassFor("6-1"), { lengthClass: "REGULAR", heightInches: 73, unparsedHeight: false });
  assert.deepEqual(lengthClassFor("6-2"), { lengthClass: "TALL", heightInches: 74, unparsedHeight: false });
  assert.deepEqual(lengthClassFor(""), { lengthClass: "REGULAR", heightInches: null, unparsedHeight: false });
  assert.deepEqual(lengthClassFor("unknown"), { lengthClass: "REGULAR", heightInches: null, unparsedHeight: true });
});
