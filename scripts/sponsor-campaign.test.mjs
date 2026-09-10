import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import * as campaigns from "../lib/sponsorCampaigns.mjs";
import * as policy from "../lib/sponsorGiftPolicy.mjs";
import { SPONSOR_CONTACT } from "../lib/sponsorshipContent.js";

// Execute production helpers/routes with in-memory service boundaries: never production gifts or email.
function load(file, dependencies, exports) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace(/export /g, "");
  return new Function(...Object.keys(dependencies), `${source}; return { ${exports.join(",")} };`)(...Object.values(dependencies));
}
function memoryLedger() {
  const rows = [];
  let writes = 0;
  return {
    rows, get writes() { return writes; },
    from(table) {
      assert.equal(table, "sponsor_gifts");
      let action = "read", value, predicates = [];
      const query = {
        insert(v) { action = "insert"; value = v; return query; },
        update(v) { action = "update"; value = v; return query; },
        select() { return query; },
        eq(key, val) { predicates.push(row => row[key] === val); return query; },
        single: async () => run(), maybeSingle: async () => run(),
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); }
      };
      function run() {
        if (action === "insert") {
          if (rows.some(row => row.invoice_id === value.invoice_id)) return { error: { code: "23505" } };
          const row = { id: `gift-${rows.length + 1}`, ...value }; rows.push(row); writes++;
          return { data: { ...row } };
        }
        const row = rows.find(row => predicates.every(matches => matches(row)));
        if (action === "update" && row) { Object.assign(row, value); writes++; }
        return { data: row ? { ...row } : null };
      }
      return query;
    }
  };
}
const key = "61fe02d8-66a7-4cbb-adc6-dcaba8f7d7a9";
function giftHelpers(db) {
  return load("lib/sponsorGifts.js", {
    ...campaigns, ...policy, supabaseAdmin: db, tierForAmount: () => "Premier",
    verifySponsorGiveToken: () => null, resolveSponsorStudentTokenClaims: () => null
  }, ["createPendingGift", "parseGiftAmountCents"]);
}
function receiptHelpers(db, sent = []) {
  return load("lib/sponsorRecognition.js", {
    ...campaigns, ...policy, crypto, SPONSOR_CONTACT, supabaseAdmin: db,
    sponsorRecognitionLive: () => true, sendBroadcastEmail: async email => sent.push(email)
  }, ["confirmGift", "renderReceiptEmail", "computeReceipt"]);
}
const baseGift = { amountCents: 150000, method: "check", requestKey: key, businessName: "Example Donor", payerEmail: "donor@example.com", campaignCode: "carnegie-2027", giftKind: "donation" };

test("campaign validation rejects forged values and preserves legacy purpose", () => {
  assert.deepEqual(campaigns.normalizeGiftPurpose(), { campaignCode: "general", giftKind: "sponsorship" });
  for (const campaign_code of ["", "other", [], {}, "CARNEGIE-2027"]) assert.throws(() => campaigns.normalizeGiftPurpose({ campaign_code }));
  assert.throws(() => campaigns.normalizeGiftPurpose({ gift_kind: "advertising" }));
});
test("real gift creation persists purpose and retries cannot switch campaign, kind or attribution", async () => {
  const db = memoryLedger(); const { createPendingGift } = giftHelpers(db);
  const first = await createPendingGift(baseGift);
  assert.equal(first.gift.campaign_code, "carnegie-2027");
  assert.equal(db.rows[0].fmv_cents, 0, "campaign gifts do not inherit merchandise benefits");
  assert.equal((await createPendingGift(baseGift)).existing, true);
  assert.equal((await createPendingGift({ ...baseGift, campaignCode: "general" })).status, 409);
  assert.equal((await createPendingGift({ ...baseGift, giftKind: "sponsorship" })).status, 409);
  assert.equal((await createPendingGift({ ...baseGift, campaignCode: "forged" })).status, 400);
  assert.equal(db.rows.length, 1);
  assert.equal(campaigns.sameGiftRequest({ ...db.rows[0], portal_student_id: "someone" }, db.rows[0]), false);
});
test("check endpoint records campaign and returns matching memo; missing receipt contact or invalid campaign writes nothing", async () => {
  const db = memoryLedger();
  const { POST } = load("app/api/sponsors/give/check/route.js", {
    ...campaigns, ...policy, ...giftHelpers(db), SPONSOR_CONTACT,
    NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) },
    sponsorFunnelLive: () => true, clientIp: () => "synthetic", checkRateLimit: async () => ({ allowed: true })
  }, ["POST"]);
  const body = { request_key: key, business_name: "Example Donor", amount_cents: 5000, campaign_code: "carnegie-2027", gift_kind: "donation", payer_email: "donor@example.com" };
  const request = body => ({ json: async () => body });
  assert.equal((await POST(request({ ...body, payer_email: "" }))).status, 400);
  assert.equal((await POST(request({ ...body, campaign_code: "forged" }))).status, 400);
  assert.equal(db.writes, 0);
  const result = await POST(request(body));
  assert.equal(result.status, 200);
  assert.match(result.body.instructions.memo, /Ashley Bands Carnegie trip 2027/);
  assert.equal(db.rows[0].status, "pending");
});
test("online create endpoint binds purpose to the stored gift and processor description", async () => {
  const db = memoryLedger(); const orders = [];
  const { POST } = load("app/api/sponsors/give/create-order/route.js", {
    ...campaigns, ...policy, ...giftHelpers(db), supabaseAdmin: db,
    NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) },
    process: { env: { PAYPAL_CLIENT_ID: "test", NEXT_PUBLIC_PAYPAL_CLIENT_ID: "test", PAYPAL_CLIENT_SECRET: "synthetic", PAYPAL_ENV: "live", VERCEL_ENV: "production" } },
    sponsorOnlineGiveLive: () => true, clientIp: () => "synthetic", checkRateLimit: async () => ({ allowed: true }),
    createOrder: async details => { orders.push(details); return { id: "SYNTHETIC-ORDER" }; }
  }, ["POST"]);
  const body = { request_key: key, business_name: "Example Business", amount_cents: 25000, campaign_code: "carnegie-2027", gift_kind: "sponsorship" };
  const request = body => ({ json: async () => body });
  assert.equal((await POST(request(body))).status, 200);
  assert.equal((await POST(request(body))).status, 200);
  assert.equal(orders.length, 1);
  assert.match(orders[0].description, /Ashley Bands Carnegie trip 2027/);
  assert.equal(orders[0].studentId, db.rows[0].id);
  assert.equal((await POST(request({ ...body, campaign_code: "general" }))).status, 409);
});
test("confirmation uses recorded campaign, emails once, and keeps personal check donors unlisted", async () => {
  const db = memoryLedger(); const sent = [];
  const { createPendingGift } = giftHelpers(db);
  const { confirmGift } = receiptHelpers(db, sent);
  const { gift } = await createPendingGift(baseGift);
  await confirmGift(gift.id, { listOnSite: true });
  await confirmGift(gift.id, { listOnSite: true });
  assert.equal(sent.length, 1);
  assert.equal(db.rows[0].listed_on_site, false);
  assert.equal(db.rows[0].deductible_cents, baseGift.amountCents);
  assert.match(sent[0].text, /Gift purpose: Ashley Bands Carnegie trip 2027/);
  assert.match(sent[0].html, /Gift purpose: Ashley Bands Carnegie trip 2027/);
  assert.match(sent[0].text, /Received:/);
  assert.match(sent[0].text, /Donor name: Example Donor/);
  assert.doesNotMatch(sent[0].text, /now listed|full amount is tax-deductible/i);
});
test("receipt escapes donor content and accounts for actual goods or services", () => {
  const { renderReceiptEmail, computeReceipt } = receiptHelpers(memoryLedger());
  const receipt = computeReceipt({ amountCents: 10000, fmvCents: 2000 });
  assert.equal(receipt.deductibleCents, 8000);
  const email = renderReceiptEmail({ businessName: "<script>example</script>", amountCents: 10000, fmvCents: 2000, deductibleCents: 8000, receiptNo: "EXAMPLE", campaignCode: "carnegie-2027", giftKind: "sponsorship", method: "online" });
  assert.match(email.text, /Tax-deductible portion of your gift: \$80.00/);
  assert.doesNotMatch(email.html, /<script>/);
});
test("campaign totals exclude other campaigns, pending, refunded and void gifts", () => {
  const gifts = [
    { campaign_code: "carnegie-2027", status: "confirmed", amount_cents: 12000 },
    { campaign_code: "carnegie-2027", status: "pending", amount_cents: 20000 },
    { campaign_code: "carnegie-2027", status: "refunded", amount_cents: 40000 },
    { campaign_code: "carnegie-2027", status: "void", amount_cents: 50000 },
    { campaign_code: "general", status: "confirmed", amount_cents: 100000 },
    { status: "confirmed", amount_cents: 70000 }
  ];
  assert.deepEqual(campaigns.campaignGiftSummary(gifts), { confirmedCount: 1, confirmedCents: 12000, pendingCount: 1, pendingCents: 20000 });
});

test("production campaign payments fail closed for sandbox, mismatched or masked credentials", () => {
  const env = { PAYPAL_CLIENT_ID: "test", NEXT_PUBLIC_PAYPAL_CLIENT_ID: "test", PAYPAL_CLIENT_SECRET: "synthetic", PAYPAL_ENV: "live", VERCEL_ENV: "production" };
  assert.equal(campaigns.campaignOnlineReady(env), true);
  for (const change of [{ PAYPAL_ENV: "sandbox" }, { PAYPAL_ENV: "" }, { PAYPAL_CLIENT_SECRET: "[SENSITIVE]" }, { NEXT_PUBLIC_PAYPAL_CLIENT_ID: "different" }]) assert.equal(campaigns.campaignOnlineReady({ ...env, ...change }), false);
});

test("capture settles the stored campaign gift and rejects unsafe production configuration before processor calls", async () => {
  const db = memoryLedger();
  const { createPendingGift } = giftHelpers(db);
  const { gift } = await createPendingGift({ ...baseGift, method: "online" });
  db.rows[0].paypal_order_id = "SYNTHETIC-ORDER";
  const env = { PAYPAL_CLIENT_ID: "test", NEXT_PUBLIC_PAYPAL_CLIENT_ID: "test", PAYPAL_CLIENT_SECRET: "synthetic", PAYPAL_ENV: "sandbox", VERCEL_ENV: "production" };
  let captures = 0; const sent = [];
  const { POST } = load("app/api/sponsors/give/capture-order/route.js", {
    ...campaigns, ...policy, ...receiptHelpers(db, sent), supabaseAdmin: db, process: { env },
    NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) },
    sponsorOnlineGiveLive: () => true, clientIp: () => "synthetic", checkRateLimit: async () => ({ allowed: true }),
    captureOrder: async () => { captures++; return { captureStatus: "COMPLETED", captureId: "SYNTHETIC-CAPTURE", invoiceId: gift.invoice_id, customId: gift.id, amountValue: "1500.00", payerEmail: "donor@example.com", payerName: "Example Donor" }; },
    extractCapture: capture => capture, amountToCents: value => Math.round(Number(value) * 100), dollars: cents => `$${cents / 100}`
  }, ["POST"]);
  const request = { url: "https://example.com/api/sponsors/give/capture-order", json: async () => ({ orderId: "SYNTHETIC-ORDER", campaign_code: "general" }) };
  assert.equal((await POST(request)).status, 503);
  assert.equal(captures, 0);
  env.PAYPAL_ENV = "live";
  assert.equal((await POST(request)).status, 200);
  assert.equal(db.rows[0].status, "confirmed");
  assert.equal(db.rows[0].campaign_code, "carnegie-2027");
  assert.match(sent[0].text, /Gift purpose: Ashley Bands Carnegie trip 2027/);
  assert.equal((await POST(request)).status, 200);
  assert.equal(captures, 1);
  assert.equal(sent.length, 1);
});

test("gift terms follow the checkout version; earlier gifts and retries cannot acquire broader terms", async () => {
  const db = memoryLedger(); const { createPendingGift } = giftHelpers(db); const sent=[];
  const { confirmGift } = receiptHelpers(db, sent);
  const old = await createPendingGift(baseGift);
  assert.equal(old.gift.gift_terms_version, 'carnegie-2027-v1');
  assert.equal((await createPendingGift({...baseGift,termsVersion:campaigns.CARNEGIE_TERMS_VERSION})).status,409);
  await confirmGift(old.gift.id);
  assert.match(sent[0].text,/boosters will contact you/);
  const next=await createPendingGift({...baseGift,requestKey:'71fe02d8-66a7-4cbb-adc6-dcaba8f7d7a9',termsVersion:campaigns.CARNEGIE_TERMS_VERSION});
  await confirmGift(next.gift.id);
  assert.equal(next.gift.gift_terms_version,'carnegie-2027-v2');
  assert.match(sent[1].text,/may use those funds for other educational activities/);
  assert.doesNotMatch(sent[1].text,/boosters will contact you/);
  assert.equal(campaigns.giftChangeTerms(null),campaigns.CARNEGIE_ORIGINAL_CHANGE_TERMS);
  assert.throws(()=>campaigns.giftTermsVersion('carnegie-2027','anything'),/reload/);
});
