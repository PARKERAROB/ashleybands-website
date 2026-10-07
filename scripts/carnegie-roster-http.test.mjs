// #187 synthetic proof: the real PATCH /api/admin/carnegie-2027 route sets the staff-only
// Carnegie yes/no flag with an audit entry, and refuses anyone who is not authorized staff.
// Runs `next dev` against an in-memory PostgREST stand-in. Never touches production.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

const SECRET = "synthetic-test-signing-secret-only";
const director = { id: "00000000-0000-4000-8000-000000000001", role: "director", display_name: "Sample Director", session_token: "synthetic-director", disabled_at: null };
const researcher = { id: "00000000-0000-4000-8000-000000000002", role: "campaign_researcher", display_name: "Sample Researcher", session_token: "synthetic-researcher", disabled_at: null };
const STUDENT_NEW = "00000000-0000-4000-9000-000000000001"; // no tracking row yet
const STUDENT_OLD = "00000000-0000-4000-9000-000000000002"; // existing reviewed row
const staff = [director, researcher];
const students = [
  { id: STUDENT_NEW, ensemble_2026: "Wind Ensemble" },
  { id: STUDENT_OLD, ensemble_2026: "Concert Band" },
];
const tracking = [{ student_id: STUDENT_OLD, eligibility_status: "approved", follow_up_status: "complete", staff_note: "kept", carnegie_roster: false }];
const audit = [];

const cookie = (person) => {
  const encoded = Buffer.from(JSON.stringify({ id: person.id, token: person.session_token, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `ab_staff_session=${encoded}.${createHmac("sha256", SECRET).update(encoded).digest("base64url")}`;
};

test("Carnegie yes/no writes the flag with an audit entry and refuses non-staff", { timeout: 180000 }, async () => {
  const backend = createServer(async (req, res) => {
    const u = new URL(req.url, "http://localhost");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const send = (value, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
    const eq = (rows, key) => rows.filter((row) => !u.searchParams.has(key) || String(row[key]) === u.searchParams.get(key).slice(3));
    const one = (rows) => String(req.headers.accept).includes("vnd.pgrst.object") ? rows[0] || null : rows;
    if (u.pathname === "/rest/v1/staff") return send(one(eq(staff, "id")));
    if (u.pathname === "/rest/v1/staff_scope_assignments") return send([]);
    if (u.pathname === "/rest/v1/portal_students") return send(one(eq(students, "id")));
    if (u.pathname === "/rest/v1/audit_log") { audit.push(body); return send(null, 201); }
    if (u.pathname === "/rest/v1/carnegie_trip_staff_tracking") {
      if (req.method === "POST") {
        for (const row of [body].flat()) {
          const existing = tracking.find((item) => item.student_id === row.student_id);
          if (existing && !String(req.headers.prefer).includes("ignore-duplicates")) Object.assign(existing, row);
          if (!existing) tracking.push({ follow_up_status: "none", staff_note: "", carnegie_roster: false, ...row });
        }
        return send(null, 201);
      }
      if (req.method === "PATCH") { for (const row of eq(tracking, "student_id")) Object.assign(row, body); return send(null, 204); }
    }
    return send({ message: `Unhandled synthetic path ${req.method} ${u.pathname}` }, 500);
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const appPort = 4327;
  const base = `http://localhost:${appPort}`;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", String(appPort)], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backend.address().port}`, SUPABASE_SECRET_KEY: "synthetic-service-key", PORTAL_SESSION_SECRET: SECRET },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const patch = (person, payload) => fetch(`${base}/api/admin/carnegie-2027`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(person ? { Cookie: cookie(person) } : {}) },
    body: JSON.stringify(payload),
  });
  try {
    let ready = false;
    for (let i = 0; i < 120 && !ready; i++) {
      try { ready = (await fetch(`${base}/api/admin/carnegie-2027`)).status === 401; } catch { /* still starting */ }
      if (!ready) await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(ready, log);

    // Negative probes: no session, or staff without forms access, can neither read nor write.
    assert.equal((await fetch(`${base}/api/admin/carnegie-2027`)).status, 401);
    assert.equal((await patch(null, { studentId: STUDENT_NEW, carnegieRoster: true })).status, 401);
    assert.equal((await patch(researcher, { studentId: STUDENT_NEW, carnegieRoster: true })).status, 403);
    assert.equal((await patch(director, { studentId: STUDENT_NEW, carnegieRoster: "yes" })).status, 400);
    assert.equal(tracking.length, 1);
    assert.equal(audit.length, 0);

    // A student with no tracking row gets the sheet's default row, then yes.
    let response = await patch(director, { studentId: STUDENT_NEW, carnegieRoster: true });
    assert.equal(response.status, 200, await response.clone().text());
    assert.match(response.headers.get("cache-control"), /no-store/);
    const created = tracking.find((row) => row.student_id === STUDENT_NEW);
    assert.equal(created.carnegie_roster, true);
    assert.equal(created.eligibility_status, "preapproved");
    assert.equal(created.updated_by_staff_id, director.id);

    // An existing row keeps its other staff fields; yes then back to no.
    for (const value of [true, false]) {
      response = await patch(director, { studentId: STUDENT_OLD, carnegieRoster: value });
      assert.equal(response.status, 200, await response.clone().text());
    }
    const kept = tracking.find((row) => row.student_id === STUDENT_OLD);
    assert.deepEqual([kept.eligibility_status, kept.follow_up_status, kept.staff_note, kept.carnegie_roster], ["approved", "complete", "kept", false]);

    assert.deepEqual(audit.map((entry) => [entry.record_id, entry.changes.carnegie_roster, entry.actor_id, entry.table_name]), [
      [STUDENT_NEW, true, director.id, "carnegie_trip_staff_tracking"],
      [STUDENT_OLD, true, director.id, "carnegie_trip_staff_tracking"],
      [STUDENT_OLD, false, director.id, "carnegie_trip_staff_tracking"],
    ]);
  } finally {
    child.kill("SIGTERM");
    await once(child, "close");
    backend.close();
  }
});
