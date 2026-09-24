import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CARNEGIE_SUPPORTERS, CARNEGIE_SUPPORTER_FIELDS } from "../lib/carnegieSupporters.mjs";

test("the supporter list is names only", () => {
  assert.ok(CARNEGIE_SUPPORTERS.length > 0);
  for (const supporter of CARNEGIE_SUPPORTERS) {
    for (const key of Object.keys(supporter)) assert.ok(CARNEGIE_SUPPORTER_FIELDS.includes(key), `unexpected field ${key}`);
    assert.equal(typeof supporter.name, "string");
    assert.ok(supporter.name.trim().length > 0);
    for (const value of Object.values(supporter)) {
      assert.doesNotMatch(value, /\$|\d{2,}|@/, "no amounts, numbers or contact details");
      assert.doesNotMatch(value, /—/, "no em dashes in public copy");
    }
  }
  assert.equal(new Set(CARNEGIE_SUPPORTERS.map((s) => s.name)).size, CARNEGIE_SUPPORTERS.length);
});

test("the homepage renders the curated list, not gift records", () => {
  const home = readFileSync(new URL("../app/page.jsx", import.meta.url), "utf8");
  assert.match(home, /from "@\/lib\/carnegieSupporters\.mjs"/);
  assert.match(home, /Thank you for helping get us there\./);
  assert.match(home, /These supporters have made a gift to our Carnegie effort so far\./);
  assert.doesNotMatch(home, /sponsor_gifts|sponsor_public_listing/);
  const section = home.slice(home.indexOf('className="home-thanks"'), home.indexOf("</section>", home.indexOf('className="home-thanks"')));
  assert.doesNotMatch(section, /amount|tier|cents|\$\{/i);
  assert.ok(home.indexOf("<CarnegieFunding />") < home.indexOf('className="home-thanks"'), "thanks sits right after the funding progress");
  assert.ok(home.indexOf('className="home-thanks"') < home.indexOf('className="home-give"'), "thanks sits before the giving funnel");
});
