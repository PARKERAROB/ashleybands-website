import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("serious family intent creates the fixed charge in the existing ledger", () => {
  const migration = read("supabase/migrations/202608310001_carnegie_commitment.sql");
  assert.match(migration, /insert into fee_charges/);
  assert.match(migration, /'carnegie_2027_conditional_deposit'.*'Carnegie Hall conditional deposit'/s);
  assert.match(migration, /5000, 'active'/);
  assert.match(migration, /p_response = 'serious_yes'/);
});

test("public intake matches exact student identity without returning the roster", () => {
  const route = read("app/api/carnegie-2027/commitment/route.js");
  const model = read("lib/carnegieTrip.js");
  assert.match(route, /findCarnegieStudentFromPublicIdentity/);
  assert.match(route, /carnegie-commitment-identity/);
  assert.match(model, /email\.endsWith\("@student\.nhcs\.net"\)/);
  assert.match(model, /normalizedName\(data\.legal_last\) !== last/);
  assert.doesNotMatch(route, /students:\s*rows/);
});

test("capture settlement verifies the fixed amount and uses the shared audit ledger RPC", () => {
  const route = read("app/api/carnegie-2027/payment/capture/route.js");
  assert.match(route, /CARNEGIE_DEPOSIT_CENTS/);
  assert.match(route, /detail\.currencyCode !== "USD"/);
  assert.match(route, /settle_online_fee_payment_with_audit/);
  assert.match(route, /payment\.category !== CARNEGIE_DEPOSIT_CATEGORY/);
});

test("unpaid commitments load payment options directly and provide a safe resume path", () => {
  const form = read("app/carnegie-2027/commit/CarnegieCommitmentClient.jsx");
  assert.match(form, /Loading secure PayPal and card options/);
  assert.match(form, /Try loading payment options again/);
  assert.match(form, /href="\/portal\/carnegie-2027"/);
  assert.match(form, /paypalSdkPromise = null/);
  assert.doesNotMatch(form, /Pay the \$50 deposit now/);
});

test("staff verbal fallback remains unsigned, unpaid, and queued for login help", () => {
  const migration = read("supabase/migrations/202608310001_carnegie_commitment.sql");
  const workspace = read("app/admin/carnegie-2027/CarnegieTripWorkspace.jsx");
  assert.match(migration, /p_source = 'staff_verbal' then null/);
  assert.match(migration, /p_source = 'staff_verbal' then 'login_help'/);
  assert.match(workspace, /does not mark payment received/);
  assert.match(workspace, /Unsigned verbal record/);
});

test("refund path reaches PayPal before reconciling the internal ledger", () => {
  const route = read("app/api/admin/carnegie-2027/route.js");
  const paypal = read("lib/paypal.js");
  assert.ok(route.indexOf("await refundCapture") < route.indexOf('rpc("settle_online_fee_refund_with_audit"'));
  assert.match(paypal, /v2\/payments\/captures\/\$\{encodeURIComponent\(captureId\)\}\/refund/);
});

test("meeting deadline slide carries the live commitment QR target", () => {
  const slides = read("app/meetings/2026-09-01/slides.js");
  const deck = read("app/meetings/2026-09-01/BoosterMeetingDeck.jsx");
  assert.match(slides, /https:\/\/ashleybands\.com\/carnegie-2027\/commit/);
  assert.match(deck, /Scan to commit and pay/);
  assert.match(deck, /QRCodeSVG value=\{slide\.url\}/);
});

test("meeting deck gives the three family numbers a clear hierarchy", () => {
  const slides = read("app/meetings/2026-09-01/slides.js");
  assert.match(slides, /Opens tonight • due Friday, September 4/);
  assert.match(slides, /kind: "promise"[\s\S]*number: "\$2,000"/);
  assert.match(slides, /id: "family-goal"[\s\S]*number: "\$500"/);
  assert.doesNotMatch(slides, /number: "\$100,000"|number: "\$160,000"/);
  assert.doesNotMatch(slides, /\["SEP 15", "\$450"/);
});

test("family materials assign each Carnegie action to a named actor", () => {
  const slides = read("app/meetings/2026-09-01/slides.js");
  const packet = JSON.parse(read("content/carnegie-2027-meeting-packet.json"));
  const form = read("app/carnegie-2027/commit/CarnegieCommitmentClient.jsx");
  assert.deepEqual(packet.roles.map((item) => item.actor), [
    "Ashley Bands",
    "Mr. Parker",
    "Ashley High School and NHCS",
    "Ashley High School Band Boosters",
  ]);
  assert.match(slides, /id: "who-does-what"[\s\S]*"Band Boosters"/);
  assert.doesNotMatch(slides, /until Ashley pays|Give Ashley|What Ashley is confirming/);
  assert.doesNotMatch(JSON.stringify(packet), /Before Ashley pays|After Ashley pays|tells Ashley it may rely|Ashley cannot responsibly/);
  assert.match(form, /Ashley High School Band Boosters pay the WorldStrides group deposit/);
});

test("family materials explain registration, FRP transfer, and shared fundraising", () => {
  const slides = read("app/meetings/2026-09-01/slides.js");
  const packet = JSON.parse(read("content/carnegie-2027-meeting-packet.json"));
  const form = read("app/carnegie-2027/commit/CarnegieCommitmentClient.jsx");
  assert.match(slides, /id: "trip-deadlines"[\s\S]*\["OCT 24", "1\/3"[\s\S]*\["JAN 7", "FINAL"/);
  assert.match(slides, /No new FRP units can be added/);
  assert.match(slides, /unused unit may be reassigned/);
  assert.match(packet.frp.summary, /individual traveler/);
  assert.match(packet.frp.known.join(" "), /within 30 days[\s\S]*reassigned/);
  assert.match(packet.funding.summary, /reduce the total trip cost for everyone/);
  assert.match(packet.openBeforeFinalAgreement.join(" "), /replacement[\s\S]*under investigation/);
  assert.match(form, /WorldStrides portal registration and required paperwork/);
  assert.match(form, /next \$225 payment[\s\S]*part of the \$2,000 ceiling/);
});

test("public family packet and downloadable PDF carry the same decision anchors", () => {
  const packet = JSON.parse(read("content/carnegie-2027-meeting-packet.json"));
  const page = read("app/carnegie-2027/meeting-packet/page.jsx");
  assert.deepEqual(packet.anchors.map((item) => item.number), ["$50", "$2,000", "$500"]);
  assert.match(packet.planningFigure, /around \$2,500/i);
  assert.match(page, /carnegie-hall-2027-family-meeting-packet\.pdf/);
  assert.ok(existsSync(new URL("../public/downloads/carnegie-hall-2027-family-meeting-packet.pdf", import.meta.url)));
});
