import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BOOKS, INSTRUMENTS, PAGE_COUNT, PIECES, cleanStudentName, validatePick } from "../lib/holidayTrios.mjs";

// Holiday trio picker (#255).
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every instrument reads a real book and every piece sits on real pages", () => {
  for (const instrument of INSTRUMENTS) assert.ok(Object.hasOwn(BOOKS, instrument.book), instrument.id);
  for (const piece of PIECES) for (const page of piece.pages) assert.ok(page >= 1 && page <= PAGE_COUNT, piece.id);
  assert.equal(new Set(PIECES.map((piece) => piece.id)).size, PIECES.length);
});

test("names are cut to first name and last initial", () => {
  assert.equal(cleanStudentName("jordan smith"), "Jordan S.");
  assert.equal(cleanStudentName("  Ana  Maria  Lopez "), "Ana L.");
  assert.equal(cleanStudentName("Sam R."), "Sam R.");
  assert.equal(cleanStudentName("<script>"), "Script");
  assert.equal(cleanStudentName("123"), "");
});

test("a pick needs every field from the fixed lists", () => {
  const good = { period: "2", name: "Jordan Smith", instrument: "tuba", piece: "joy-to-the-world", part: 3 };
  assert.deepEqual(validatePick(good).pick, { period: "2", instrument: "tuba", piece: "joy-to-the-world", part: 3, name: "Jordan S." });
  assert.ok(validatePick({ ...good, period: "3" }).error);
  assert.ok(validatePick({ ...good, part: 4 }).error);
  assert.ok(validatePick({ ...good, piece: "nope" }).error);
  assert.ok(validatePick({ ...good, instrument: "kazoo" }).error);
  assert.ok(validatePick({ ...good, name: "Jordan" }).error);
});

test("the picker stays unlisted and its music stays out of the repo", async () => {
  const config = await read("next.config.js");
  assert.match(config, /"\/trios\/:path\*", headers: \[.*X-Robots-Tag/);
  assert.match(config, /"\/api\/trios\/:path\*", headers: \[.*X-Robots-Tag/);
  const page = await read("app/trios/[slug]/page.jsx");
  assert.match(page, /index: false/);
  for (const route of ["app/api/trios/[slug]/route.js", "app/api/trios/[slug]/picks/route.js"]) {
    assert.match(await read(route), /slug !== TRIOS_SLUG/);
  }
  assert.match(await read("app/api/trios/[slug]/route.js"), /createSignedUrls/);
});
