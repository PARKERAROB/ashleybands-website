import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import * as campaigns from "../lib/sponsorCampaigns.mjs";
import * as policy from "../lib/sponsorGiftPolicy.mjs";

// Carnegie student credit is record-keeping only and never enters marching math (#103).
// In-memory fixtures only: no production gifts, students or email.
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const STUDENT = "0f5d2a58-4c1e-4a7e-9d5e-2b8f6c1a9e01";
const OTHER = "7a1c3e55-9b2d-4f60-8e11-3c4d5e6f7a8b";

const gifts = [
  { id: "g1", campaign_code: "general", status: "confirmed", portal_student_id: STUDENT, amount_cents: 10000 },
  { id: "g2", campaign_code: "carnegie-2027", status: "confirmed", portal_student_id: STUDENT, amount_cents: 25000 },
  { id: "g3", campaign_code: "carnegie-2027", status: "pending", portal_student_id: STUDENT, amount_cents: 5000 },
  { id: "g4", campaign_code: "carnegie-2027", status: "confirmed", portal_student_id: null, amount_cents: 7000 },
  { id: "g5", campaign_code: "carnegie-2027", status: "confirmed", portal_student_id: OTHER, amount_cents: 2500 },
  { id: "g6", campaign_code: null, status: "confirmed", portal_student_id: OTHER, amount_cents: 1500 }
];

test("marching student credit counts only general gifts", () => {
  assert.equal(campaigns.MARCHING_STUDENT_CREDIT_CAMPAIGN, "general");
  const marching = gifts.filter((gift) => gift.status === "confirmed" && gift.portal_student_id && campaigns.countsTowardMarchingStudentCredit(gift));
  assert.deepEqual(marching.map((gift) => gift.id), ["g1", "g6"]);
  const studentMarching = marching.filter((gift) => gift.portal_student_id === STUDENT).reduce((sum, gift) => sum + gift.amount_cents, 0);
  assert.equal(studentMarching, 10000, "the Carnegie gift does not change the student's marching figures");
});

test("a Carnegie student credit is one amount shown two ways", () => {
  const campaign = campaigns.campaignGiftSummary(gifts);
  assert.equal(campaign.confirmedCents, 25000 + 7000 + 2500, "every confirmed Carnegie gift is in the band total");
  const credit = campaigns.carnegieStudentCreditTotals(gifts);
  assert.deepEqual(credit, [
    { studentId: STUDENT, confirmedGifts: 1, confirmedCents: 25000 },
    { studentId: OTHER, confirmedGifts: 1, confirmedCents: 2500 }
  ]);
  const creditedCents = credit.reduce((sum, row) => sum + row.confirmedCents, 0);
  assert.ok(creditedCents <= campaign.confirmedCents, "student credit is a view of the band total, never added to it");
  assert.equal(campaigns.carnegieStudentCreditTotals([{ ...gifts[1], status: "pending" }]).length, 0);
  assert.equal(campaigns.carnegieStudentCreditTotals([{ ...gifts[1], campaign_code: "general" }]).length, 0);
});

test("the donor line uses the first name only and keeps the group framing", () => {
  assert.equal(
    campaigns.carnegieStudentGiftLine("Sam Example"),
    "Every gift lowers the trip cost for every student. Yours counts toward Sam’s music notes and the band’s Carnegie total."
  );
  assert.equal(campaigns.carnegieStudentGiftLine(""), null);
  assert.doesNotMatch(campaigns.carnegieStudentGiftLine("Sam"), /—|balance|account|funded/i);
  const client = read("app/sponsors/give/GiveClient.jsx");
  assert.match(client, /\{studentName \? <p className="give-lede give-student-credit">\{carnegieStudentGiftLine\(studentName\)\}<\/p> : null\}/);
  assert.ok(client.indexOf("carnegieStudentGiftLine(studentName)") > client.indexOf("{carnegie ? <>"), "line appears only in the Carnegie branch");
  const page = read("app/support-carnegie/page.jsx");
  assert.match(page, /CARNEGIE_PURPOSE/, "existing campaign terms remain on the page");
});

test("the Carnegie student route signs the same student token and lands on the Carnegie page", () => {
  const carnegieRoute = read("app/support/[code]/carnegie/page.jsx");
  assert.match(carnegieRoute, /resolveSponsorStudentCode\(code\)/);
  assert.match(carnegieRoute, /signSponsorStudentGiveToken\(\{\s*linkId: resolved\.link\.id,\s*studentId: resolved\.student\.id\s*\}\)/);
  assert.match(carnegieRoute, /redirect\(`\$\{CARNEGIE_GIVING_PATH\}\?a=\$\{encodeURIComponent\(token\)\}#make-a-gift`\)/);
  assert.equal(campaigns.CARNEGIE_GIVING_PATH, "/support-carnegie");
  const general = read("app/support/[code]/page.jsx");
  assert.match(general, /redirect\(`\/sponsors\/give\?a=\$\{encodeURIComponent\(token\)\}`\)/, "the general student link is unchanged");
  assert.doesNotMatch(general, /carnegie/i);
});

test("every per-student marching or sponsorship gift read is scoped to general gifts", () => {
  for (const file of [
    "app/api/sponsors/portal-dashboard/route.js",
    "app/api/admin/marching-band/funding/route.js",
    "lib/financialOperations.js",
    "lib/currentStudents.js"
  ]) {
    const source = read(file);
    const reads = source.split(/from\("sponsor_gifts"\)/).slice(1).map((chunk) => chunk.slice(0, 400));
    assert.ok(reads.length > 0, `${file} reads sponsor_gifts`);
    for (const chunk of reads) {
      if (!/portal_student_id|family_id/.test(chunk)) continue;
      assert.match(chunk, /\.eq\("campaign_code", MARCHING_STUDENT_CREDIT_CAMPAIGN\)/, `${file} scopes student gift math by campaign`);
    }
  }
  const billing = read("app/api/billing/me/route.js");
  assert.match(billing, /from\("student_campaign_summary"\)/, "family billing reads the campaign-scoped view");
});

test("the forward migration scopes the views and adds a staff-only Carnegie credit view", () => {
  const sql = read("supabase/migrations/202609240001_campaign_scoped_student_credit.sql");
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|drop)\b/i, "no data changes or drops");
  const view = (name) => {
    const start = sql.indexOf(`create or replace view public.${name}`);
    assert.ok(start >= 0, name);
    return sql.slice(start, sql.indexOf(";", start));
  };
  assert.match(view("student_campaign_summary"), /status = 'confirmed' and portal_student_id is not null and campaign_code = 'general'/);
  assert.match(view("sponsor_student_totals"), /g\.campaign_code = 'general'/);
  assert.match(view("sponsor_family_totals"), /g\.campaign_code = 'general'/);
  assert.match(view("carnegie_student_credit_totals"), /g\.campaign_code = 'carnegie-2027' and g\.portal_student_id is not null/);
  for (const name of ["student_campaign_summary", "sponsor_student_totals", "sponsor_family_totals", "carnegie_student_credit_totals"]) {
    assert.match(view(name), /with \(security_invoker = true\)/);
    assert.match(sql, new RegExp(`revoke all privileges on table public\\.${name} from anon, authenticated;`));
  }
  // The family-visible column list is unchanged.
  for (const column of ["goal_cents", "family_contribution_cents", "confirmed_gift_cents", "legacy_sponsorship_credit_cents", "raised_cents", "remaining_cents"]) {
    assert.match(view("student_campaign_summary"), new RegExp(`as ${column}`));
  }
});

function memoryDb({ students = [] } = {}) {
  const rows = [];
  return {
    rows,
    from(table) {
      let action = "read", value;
      const predicates = [];
      const query = {
        insert(v) { action = "insert"; value = v; return query; },
        select() { return query; },
        eq(key, val) { predicates.push((row) => row[key] === val); return query; },
        single: async () => run(), maybeSingle: async () => run()
      };
      function run() {
        if (table === "portal_students") return { data: students.find((row) => predicates.every((match) => match(row))) || null };
        assert.equal(table, "sponsor_gifts");
        if (action === "insert") {
          if (rows.some((row) => row.invoice_id === value.invoice_id)) return { error: { code: "23505" } };
          const row = { id: `gift-${rows.length + 1}`, ...value };
          rows.push(row);
          return { data: { ...row } };
        }
        return { data: rows.find((row) => predicates.every((match) => match(row))) || null };
      }
      return query;
    }
  };
}
function giftHelpers(db, { studentClaims = null } = {}) {
  const source = read("lib/sponsorGifts.js").replace(/^import[\s\S]*?;\n/gm, "").replace(/export /g, "");
  const deps = {
    ...campaigns, ...policy, supabaseAdmin: db, tierForAmount: () => "Friend",
    verifySponsorGiveToken: (token) => (token === "student-token" ? { linkId: "link-1", studentId: STUDENT } : null),
    resolveSponsorStudentTokenClaims: async () => studentClaims
  };
  return new Function(...Object.keys(deps), `${source}; return { createPendingGift };`)(...Object.values(deps));
}
const base = { amountCents: 25000, method: "check", businessName: "Example Donor", payerEmail: "donor@example.com", recordedBy: "test", campaignCode: "carnegie-2027", giftKind: "donation" };

test("a Carnegie gift through a student link records the campaign and the student credit", async () => {
  const db = memoryDb();
  const { createPendingGift } = giftHelpers(db, { studentClaims: { linkId: "link-1", portalStudentId: STUDENT, studentName: "Sam" } });
  const result = await createPendingGift({ ...base, method: "online", requestKey: "8b6f3c1e-2d4a-4b5c-9e7f-0a1b2c3d4e5f", attributionToken: "student-token", termsVersion: "carnegie-2027-v2" });
  assert.equal(result.error, undefined);
  assert.equal(db.rows[0].campaign_code, "carnegie-2027");
  assert.equal(db.rows[0].portal_student_id, STUDENT);
  assert.equal(db.rows[0].status, "pending");
});

test("staff student credit is Carnegie-only, active-only and never combined with a link", async () => {
  const students = [{ id: STUDENT, status: "active" }, { id: OTHER, status: "inactive" }];
  const db = memoryDb({ students });
  const { createPendingGift } = giftHelpers(db);
  const ok = await createPendingGift({ ...base, requestKey: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", staffStudentId: STUDENT, termsVersion: null, notes: "Offline check recorded by staff." });
  assert.equal(ok.error, undefined);
  assert.equal(db.rows[0].portal_student_id, STUDENT);
  assert.equal(db.rows[0].campaign_code, "carnegie-2027");
  assert.equal(db.rows[0].gift_terms_version, "carnegie-2027-v1", "offline gifts keep the original, more donor-protective terms");
  assert.equal(db.rows[0].notes, "Offline check recorded by staff.");

  const general = await createPendingGift({ ...base, campaignCode: "general", giftKind: "sponsorship", requestKey: "2c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", staffStudentId: STUDENT });
  assert.match(general.error, /Carnegie offline gifts only/);
  const inactive = await createPendingGift({ ...base, requestKey: "3c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", staffStudentId: OTHER });
  assert.match(inactive.error, /active student/);
  const withLink = await createPendingGift({ ...base, requestKey: "4c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", staffStudentId: STUDENT, attributionToken: "student-token" });
  assert.ok(withLink.error);
  assert.equal(db.rows.length, 1, "rejected requests write nothing");
});

test("offline gift input is validated before any write", () => {
  const valid = { donor_name: " Example Donor ", method: "check", gift_kind: "donation", amount: 50, request_key: "5c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f", payer_email: "Donor@Example.com", student_id: STUDENT, memo: "for Sam" };
  const input = campaigns.normalizeOfflineGiftInput(valid);
  assert.equal(input.campaignCode, "carnegie-2027");
  assert.equal(input.donorName, "Example Donor");
  assert.equal(input.payerEmail, "donor@example.com");
  assert.equal(input.studentId, STUDENT);
  assert.equal(campaigns.normalizeOfflineGiftInput({ ...valid, student_id: "" }).studentId, null);
  assert.throws(() => campaigns.normalizeOfflineGiftInput({ ...valid, campaign_code: "general" }), /Carnegie/);
  assert.throws(() => campaigns.normalizeOfflineGiftInput({ ...valid, method: "online" }), /check or cash/);
  assert.throws(() => campaigns.normalizeOfflineGiftInput({ ...valid, donor_name: " " }), /donor/);
  assert.throws(() => campaigns.normalizeOfflineGiftInput({ ...valid, student_id: "not-a-uuid" }), /student/);
  assert.throws(() => campaigns.normalizeOfflineGiftInput({ ...valid, request_key: "x" }), /Reload/);
  assert.throws(() => campaigns.normalizeOfflineGiftInput({ ...valid, payer_email: "nope" }), /email/);
});

test("the offline gift routes are staff-only, audited and never auto-publish", () => {
  const route = read("app/api/sponsors/gifts/route.js");
  const post = route.slice(route.indexOf("export async function POST"));
  assert.match(post, /authorizeStaffRequest\(req, STAFF_CAPABILITIES\.SPONSORSHIP_GIFTS_WRITE\)/);
  assert.ok(post.indexOf("logAuditRequired") < post.indexOf("createPendingGift("), "audit precedes the write");
  assert.match(post, /attributionToken: null/);
  assert.match(post, /listOnSite: false/);
  assert.match(post, /confirmGift\(created\.gift\.id/, "confirmation uses the existing receipt path");
  const lookup = read("app/api/sponsors/gifts/students/route.js");
  assert.match(lookup, /authorizeStaffRequest\(req, STAFF_CAPABILITIES\.SPONSORSHIP_GIFTS_WRITE\)/);
  assert.match(lookup, /select\("id, display_name, grade_fall26"\)/, "least data");
  assert.match(lookup, /logAudit\(/);
  assert.match(lookup, /replace\(\/\[\^\\p\{L\}\\p\{M\}' -\]\/gu, ""\)/, "filter syntax characters cannot reach PostgREST");
});
