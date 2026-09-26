import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isCurrentFundraiser } from "../lib/fundraiserStatus.mjs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const data = JSON.parse(read("content/site-data.json"));
const knowledge = read("public/chatbot-knowledge.txt");

test("historical payment and campaign instructions cannot become current assistant answers", () => {
  for (const slug of ["spring-trip", "instaraise-fundraiser"]) {
    const page = data.pages.find((item) => item.slug === slug);
    assert.equal(page.archived, true);
    assert.equal(page.category, "Archive");
    assert(!knowledge.includes(page.body), `${slug} must stay outside the current knowledge`);
  }
  for (const stale of ["Cost: $300 per person", "fundraiser is live", "now through May 14", "Annual PKA trigger", "FOCUS objectives assigned to Rob", "Gmail — Staff Listserv"]) {
    assert(!knowledge.includes(stale), `Unexpected stale/internal content: ${stale}`);
  }
});

test("Carnegie answers preserve conditional funding and distinct deposit choices", () => {
  for (const required of ["planning around $2,500", "not a final price", "below $2,000", "cannot be paid at this time creates no new charge", "does not change the yes response", "do not submit again or pay another $50", "not the final trip contract", "current commitment form contains the updated response and deposit choices"]) {
    assert(knowledge.includes(required), `Missing family boundary: ${required}`);
  }
  assert(knowledge.includes("/carnegie-2027/commit"));
  assert(!knowledge.includes("PERRY'S POPCORN FUNDRAISER"), "ended fundraisers leave the assistant (#113)");
  assert(!knowledge.includes("ASHLEY BANDS MATTRESS FUNDRAISER"), "the mattress sale ended September 26 (#123)");
});

test("ended fundraisers leave current lists by archive flag or endsAt (#123)", () => {
  const mattress = data.fundraisers.find((item) => item.slug === "mattress");
  assert.equal(mattress.archived, true);
  assert.match(mattress.status, /^Ended September 26/);
  const open = { slug: "x", endsAt: "2026-09-27T04:00:00.000Z" };
  assert.equal(isCurrentFundraiser(open, Date.parse("2026-09-26T23:59:59-04:00")), true);
  assert.equal(isCurrentFundraiser(open, Date.parse("2026-09-27T00:00:00-04:00")), false);
  assert.equal(isCurrentFundraiser({ slug: "y" }, Date.now()), true);
  assert.equal(isCurrentFundraiser({ slug: "z", archived: true }, 0), false);
  const bandInfo = data.pages.find((item) => item.slug === "2026-2027-band-information");
  assert(!bandInfo.body.includes("mattress fundraiser"), "Band Info no longer lists the ended sale");
  assert(bandInfo.body.includes("Band Words, Explained"));
});
