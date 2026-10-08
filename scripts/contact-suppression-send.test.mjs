// #190: self-requested mail (sign-in codes, receipts) bypasses the opt-out list;
// every other send is still filtered; send-time skips count as skipped.
// Runs real lib code against a stubbed network: fake provider key, unroutable DB.
import assert from "node:assert/strict";
import test from "node:test";

process.env.RESEND_API_KEY = "re_fake_test_key_never_valid";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_SECRET_KEY = "test-only";

const OPTED = "opted@example.test";
const providerCalls = [];
let db = {};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method || "GET").toUpperCase();
  if (url.hostname === "api.resend.com") {
    providerCalls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `fake-${providerCalls.length}` }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (url.hostname !== "127.0.0.1") throw new Error(`Unexpected network call to ${url.hostname}`);
  const table = url.pathname.split("/").pop();
  const headers = { "content-type": "application/json", "content-range": "0-0/0" };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  if (method === "PATCH") {
    (db.updates ||= []).push([table, JSON.parse(init.body)]);
    return new Response("[]", { status: 200, headers });
  }
  const rows = db[table] || [];
  const accept = new Headers(init.headers).get("accept") || "";
  const body = accept.includes("vnd.pgrst.object") ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows);
  return new Response(body, { status: 200, headers });
};

const { sendPortalCodeEmail, sendFeePaymentReceiptEmail, sendBroadcastEmail } = await import("../lib/portalEmail.js");
const { dispatchBroadcast } = await import("../lib/broadcast.js");
const { sendFailureUpdate, ContactSuppressedError } = await import("../lib/contactSuppression.js");

function reset() {
  providerCalls.length = 0;
  db = { contact_suppressions: [{ value_normalized: OPTED }] };
}

test("a suppressed address still gets a sign-in code", async () => {
  reset();
  await sendPortalCodeEmail({ to: "Opted@Example.test", code: "123456" });
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(providerCalls[0].to, ["Opted@Example.test"]);
});

test("a suppressed address still gets a payment receipt", async () => {
  reset();
  await sendFeePaymentReceiptEmail({ to: OPTED, studentName: "Student", amount: "$1.00", method: "test", invoiceId: "inv-1" });
  assert.equal(providerCalls.length, 1);
  assert.deepEqual(providerCalls[0].to, [OPTED]);
});

test("the same address is dropped from a default send (broadcast, newsletter, media consent use it)", async () => {
  reset();
  await assert.rejects(sendBroadcastEmail({ to: "OPTED@example.test", subject: "Hi", html: "<p>x</p>" }), ContactSuppressedError);
  assert.equal(providerCalls.length, 0, "nothing reached the provider");
  await sendBroadcastEmail({ to: "keep@example.test", subject: "Hi", html: "<p>x</p>" });
  assert.equal(providerCalls.length, 1);
});

test("a broadcast drops the suppressed recipient at send time and counts it as skipped", async () => {
  reset();
  db.broadcasts = [{ id: "b1", subject: "Hi", body_html: "<p>x</p>", status: "sending" }];
  db.broadcast_recipients = [
    { id: "r1", email: OPTED, student_id: "s1", person_id: "p1" },
    { id: "r2", email: "keep@example.test", student_id: "s1", person_id: "p2" },
  ];
  const result = await dispatchBroadcast("b1");
  assert.equal(result.sent, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(providerCalls.map((c) => c.to), [["keep@example.test"]]);
  assert.ok(db.updates.some(([table, row]) => table === "broadcast_recipients" && row.send_status === "skipped" && row.send_error === "contact_suppressed"));
});

test("send failures other than suppression stay failed", () => {
  assert.deepEqual(sendFailureUpdate(new ContactSuppressedError()), { send_status: "skipped", send_error: "contact_suppressed" });
  assert.equal(sendFailureUpdate(new Error("provider down")).send_status, "failed");
});
