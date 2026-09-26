import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Internal briefs render only for signed-in program staff (#142).
const GATED_PAGES = ["app/leadership-brief/page.jsx", "app/mpa-analysis/page.jsx", "app/raleigh-brief/page.jsx"];

test("each internal brief checks the staff session before rendering", async () => {
  for (const file of GATED_PAGES) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /if \(!\(await staffCanReadInternalDocs\(\)\)\) return <StaffOnlyNotice/, `${file} must gate on the staff session`);
  }
});

test("only director and program staff read internal briefs", async () => {
  const access = await readFile(new URL("../lib/staffPageAccess.js", import.meta.url), "utf8");
  assert.match(access, /INTERNAL_DOC_ROLES = Object\.freeze\(\["director", "program_staff"\]\)/);
});

test("public pages do not link to the internal briefs", async () => {
  const repertoire = await readFile(new URL("../app/mpa-repertoire/MpaRepertoireClient.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(repertoire, /href="\/mpa-analysis"/);
});
