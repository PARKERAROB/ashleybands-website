import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { CARNEGIE_SUPPORTERS, CARNEGIE_SUPPORTER_FIELDS, MARCHING_SPONSORS, sponsorLogo } from "../lib/carnegieSupporters.mjs";

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

test("curated logos match names case-insensitively and point at shipped files (#175)", () => {
  const logo = sponsorLogo("Beach Bagels & Subs");
  assert.ok(logo, "Beach Bagels has a logo");
  assert.deepEqual(sponsorLogo("  BEACH  bagels & subs "), logo);
  assert.ok(existsSync(new URL(`../public${logo.src}`, import.meta.url)), "logo file is in public/");
  assert.ok(logo.width > 0 && logo.height > 0);
  assert.equal(sponsorLogo("Sheetz"), null, "businesses without a logo stay name-only");
  assert.equal(sponsorLogo(""), null);
  assert.ok(CARNEGIE_SUPPORTERS.some((s) => s.name === "Beach Bagels & Subs"));
});

test("both pages render logos with the business name as alt text", () => {
  const home = readFileSync(new URL("../app/page.jsx", import.meta.url), "utf8");
  const sponsors = readFileSync(new URL("../app/sponsors/page.jsx", import.meta.url), "utf8");
  assert.match(home, /sponsorLogo\(supporter\.name\)/);
  assert.match(home, /alt=\{supporter\.name\}/);
  assert.match(sponsors, /sponsorLogo\(name\)/);
  assert.match(sponsors, /alt=\{name\}/);
});

test("the sponsors page shows marching and Carnegie business lists, names only, no overlap (#185)", () => {
  assert.ok(MARCHING_SPONSORS.length > 0);
  for (const sponsor of MARCHING_SPONSORS) {
    for (const key of Object.keys(sponsor)) assert.ok(CARNEGIE_SUPPORTER_FIELDS.includes(key), `unexpected field ${key}`);
    for (const value of Object.values(sponsor)) assert.doesNotMatch(value, /\$|\d{2,}|@|—/);
  }
  const carnegie = new Set(CARNEGIE_SUPPORTERS.map((s) => s.name));
  assert.equal(new Set(MARCHING_SPONSORS.map((s) => s.name)).size, MARCHING_SPONSORS.length);
  for (const s of MARCHING_SPONSORS) assert.ok(!carnegie.has(s.name), `${s.name} is listed under both funds`);
  const page = readFileSync(new URL("../app/sponsors/page.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /sponsor_public_listing|supabaseAdmin/);
  assert.match(page, /MARCHING_SPONSORS/);
  assert.match(page, /CARNEGIE_SUPPORTERS/);
});
