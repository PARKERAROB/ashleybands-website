import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { signSponsorStudentGiveToken, signSupporterGiveToken, verifySponsorGiveToken } from "../lib/sponsorGiveToken.mjs";
import { CAMPAIGN_GIFT_LINE, carnegieSupporterPreview, giftCreditedCents, supporterFirstName } from "../lib/carnegieLetters.mjs";

const secret = "test-secret";
const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("a supporter token names the link and can never name a student", () => {
  const token = signSupporterGiveToken({ supporterLinkId: "link-1" }, { secret });
  assert.deepEqual(verifySponsorGiveToken(token, { secret }), { supporterLinkId: "link-1" });
  const [encoded] = token.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(payload).sort(), ["exp", "sl"]);
});

test("a tampered or expired supporter token fails, and student tokens still verify", () => {
  const token = signSupporterGiveToken({ supporterLinkId: "link-1" }, { secret });
  assert.equal(verifySponsorGiveToken(`${token}x`, { secret }), null);
  const expired = signSupporterGiveToken({ supporterLinkId: "link-1" }, { secret, nowMs: 1000, ttlMs: 1000 });
  assert.equal(verifySponsorGiveToken(expired, { secret }), null);
  const student = signSponsorStudentGiveToken({ linkId: "l", studentId: "s" }, { secret });
  assert.deepEqual(verifySponsorGiveToken(student, { secret }), { linkId: "l", studentId: "s" });
});

test("gifts carry the supporter id only on supporter gifts and never a student", () => {
  const text = source("lib/sponsorGifts.js");
  assert.match(text, /\.\.\.\(targets\.supporterLinkId \? \{ supporter_link_id: targets\.supporterLinkId \} : \{\}\)/);
  const branch = text.slice(text.indexOf("if (tokenClaims.supporterLinkId)"), text.indexOf("if (tokenClaims.linkId && tokenClaims.studentId)"));
  assert.match(branch, /portalStudentId: null/);
  assert.match(branch, /businessName: String\(businessName \|\| ""\)\.trim\(\)/);
  assert.match(source("supabase/migrations/202610300001_carnegie_supporter_links.sql"), /supporter_link_id is null or portal_student_id is null/);
});

test("a supporter link leaves the donor's own name editable", () => {
  assert.match(source("app/sponsors/give/GiveClient.jsx"), /readOnly=\{Boolean\(attributionToken\) && !studentName && !supporterName\}/);
});

test("the preview uses a first name only and promises the whole trip", () => {
  assert.equal(supporterFirstName("Pat Example"), "Pat");
  const preview = carnegieSupporterPreview("Pat Example");
  assert.equal(preview.description, `Fill a music note with Pat. ${CAMPAIGN_GIFT_LINE}`);
  assert.doesNotMatch(JSON.stringify(preview), /Example/);
});

test("the supporter chart counts what the Boosters received, the same as a student's", () => {
  assert.equal(giftCreditedCents({ amount_cents: 10000, paypal_fee_cents: 348 }), 9652);
  assert.match(source("lib/carnegieSupporterLinks.js"), /\.eq\("status", "confirmed"\)/);
});

test("the giving page sends a preview image that needs no gate, names or photos", () => {
  const page = source("app/support-carnegie/page.jsx");
  assert.match(page, /openGraph/);
  assert.match(page, /CARNEGIE_PREVIEW_IMAGE/);
  const image = source("app/api/carnegie-2027/og/route.js");
  assert.doesNotMatch(image, /carnegieLettersAccess|supabase/);
});
