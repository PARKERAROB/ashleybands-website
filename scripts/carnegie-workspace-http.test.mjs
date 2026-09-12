import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
// Synthetic end-to-end proof: isolated HTTP backend, actual Next routes and browser UI.
// Never connects to production or writes real workspace data.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
const require = createRequire(import.meta.url);
const SECRET = "synthetic-test-signing-secret-only";
const staff = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    role: "director",
    display_name: "Sample Director",
    session_token: "synthetic-director",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    role: "campaign_researcher",
    display_name: "Sample Researcher",
    session_token: "synthetic-researcher",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    role: "campaign_researcher",
    display_name: "Sample Coordinator",
    session_token: "synthetic-coordinator",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    role: "campaign_researcher",
    display_name: "Sample Finance Owner",
    session_token: "synthetic-finance",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    role: "director",
    display_name: "Other Director",
    session_token: "synthetic-other-director",
  },
];
staff.push({ id: "00000000-0000-4000-8000-000000000006", role: "campaign_researcher", display_name: "Sample Viewer", session_token: "synthetic-viewer" });
const members = [
  { staff_id: staff[5].id, domains: [], access: "viewer" },
  { staff_id: staff[2].id, domains: ["coordination"] },
  { staff_id: staff[3].id, domains: ["finance"] },
];
// Synthetic credentials exercise the real staff-auth route against this isolated backend.
for (const [index, person] of staff.entries()) {
  person.email = `staff-${index}@example.com`;
  person.pin_hash = bcrypt.hashSync("246810", 4);
}
const cookie = (person) => {
  const encoded = Buffer.from(
    JSON.stringify({
      id: person.id,
      token: person.session_token,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return `ab_staff_session=${encoded}.${createHmac("sha256", SECRET).update(encoded).digest("base64url")}`;
};
test(
  "actual private routes and responsive UI with synthetic storage",
  { timeout: 180000 },
  async () => {
    const output = await mkdtemp(join(tmpdir(), "carnegie-http-"));
    let current = {
      primary_owner_id: staff[0].id,
      revision: 0,
      state: { records: [], proposals: [], commitments: [], documents: [] },
      updated_at: new Date().toISOString(),
    };
    const agentKeys = [];
    const history = [],
      objects = new Map();
    let rpcCount = 0;
    const backend = createServer(async (req, res) => {
      const u = new URL(req.url, "http://localhost");
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const bytes = Buffer.concat(chunks);
      const json = () => JSON.parse(bytes.toString());
      const send = (value, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(value));
      };
      const filter = (rows) =>
        rows.filter((r) =>
          [...u.searchParams].every(([k, v]) =>
            ["select", "order", "limit"].includes(k) || v.startsWith("eq.")
              ? ["select", "order", "limit"].includes(k) ||
                String(r[k]) === v.slice(3)
              : v.startsWith("in.(")
                ? v.slice(4, -1).split(",").includes(r[k])
                : v === "is.null"
                  ? r[k] == null
                  : true,
          ),
        );
      if (u.pathname === "/rest/v1/auth_rate_limits")
        return send(null, req.method === "GET" ? 200 : 201);
      if (u.pathname === "/rest/v1/staff") {
        const matching = filter(staff);
        if (req.method === "PATCH")
          for (const person of matching) Object.assign(person, json());
        const columns = (u.searchParams.get("select") || "id")
          .split(",")
          .map((s) => s.trim());
        const rows = matching.map((person) =>
          Object.fromEntries(columns.map((key) => [key, person[key] ?? null])),
        );
        return send(
          String(req.headers.accept).includes("vnd.pgrst.object")
            ? rows[0] || null
            : rows,
        );
      }
      if (u.pathname === "/rest/v1/carnegie_workspace_agent_keys") {
        if (req.method === "POST") { agentKeys.push({ ...json(), created_at: new Date().toISOString(), revoked_at: null }); return send(null, 201); }
        const rows = filter(agentKeys);
        if (req.method === "PATCH") { for (const key of rows) Object.assign(key, json()); return send(null); }
        const columns = (u.searchParams.get("select") || "id").split(",");
        const projected = rows.map(row => Object.fromEntries(columns.map(k => [k, row[k]])));
        return send(String(req.headers.accept).includes("vnd.pgrst.object") ? projected[0] || null : projected);
      }
      if (u.pathname === "/rest/v1/carnegie_workspace_members") {
        const rows = filter(members);
        return send(u.searchParams.has("staff_id") ? rows[0] || null : rows);
      }
      if (u.pathname === "/rest/v1/carnegie_workspace") return send(current);
      if (u.pathname === "/rest/v1/carnegie_workspace_history")
        return send(
          u.searchParams.has("revision")
            ? history.find(
                (h) =>
                  String(h.revision) ===
                  u.searchParams.get("revision").slice(3),
              )
            : [...history].reverse().slice(0, 100),
        );
      if (u.pathname === "/rest/v1/audit_log") return send(null, 201);
      if (u.pathname === "/rest/v1/rpc/save_carnegie_workspace") {
        const p = json();
        if (p.p_revision !== current.revision)
          return send({ code: "40001", message: "stale" }, 409);
        current = {
          primary_owner_id: staff[0].id,
          revision: current.revision + 1,
          state: p.p_state,
          updated_at: new Date().toISOString(),
        };
        rpcCount++;
        history.push({
          revision: current.revision,
          actor_id: p.p_actor,
          action: p.p_action,
          source: p.p_source,
          created_at: current.updated_at,
          state: structuredClone(current.state),
        });
        return send(current.revision);
      }
      if (u.pathname === "/storage/v1/bucket/carnegie-workspace")
        return send({ id: "carnegie-workspace", public: false });
      if (u.pathname.startsWith("/storage/v1/object/")) {
        const path = u.pathname
          .replace("/storage/v1/object/authenticated/", "")
          .replace("/storage/v1/object/", "");
        if (req.method === "POST") {
          if (objects.has(path)) return send({ message: "duplicate" }, 409);
          objects.set(path, bytes);
          return send({ Key: path });
        }
        if (!objects.has(path)) return send({ message: "missing" }, 404);
        res.writeHead(200, { "Content-Type": "application/octet-stream" });
        return res.end(objects.get(path));
      }
      return send({ message: `Unhandled synthetic path ${u.pathname}` }, 500);
    });
    backend.listen(0, "127.0.0.1");
    await once(backend, "listening");
    const backendPort = backend.address().port;
    const appPort = 4319;
    const base = `http://localhost:${appPort}`;
    const child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "--port", String(appPort)],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${backendPort}`,
          SUPABASE_SECRET_KEY: "synthetic-service-key",
          PORTAL_SESSION_SECRET: SECRET,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    const api = "/api/carnegie-2027/team";
    const request = async (path = api, person = staff[0], body, extra = {}) =>
      fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(person ? { Cookie: cookie(person) } : {}),
          ...(body !== undefined
            ? { "Content-Type": "application/json", Origin: base }
            : {}),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    async function get() {
      const r = await request();
      assert.equal(r.status, 200);
      return r.json();
    }
    async function command(payload, person = staff[0], expected = 200) {
      const response = await request(api, person, {
        ...payload,
        source: "Synthetic evidence only",
        revision: current.revision,
      });
      assert.equal(response.status, expected, await response.clone().text());
      return response.json();
    }
    let browser;
    try {
      let ready = false;
      for (let i = 0; i < 120; i++) {
        try {
          if ((await fetch(base + api)).status === 401) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
      assert.ok(ready, log);
      for (const path of [api, api + "/files?id=missing", api + "/package"]) {
        for (const [person, status] of [
          [null, 401],
          [staff[1], 403],
          [staff[4], 403],
        ]) {
          const r = await request(path, person);
          assert.equal(r.status, status);
          assert.match(r.headers.get("cache-control"), /no-store/);
        }
      }
      for (const path of [api, api + "/files", api + "/import"]) {
        assert.equal((await request(path, staff[1], {})).status, 403);
        assert.equal((await request(path, null, {})).status, 401);
        assert.equal(
          (
            await request(
              path,
              staff[0],
              {},
              { Origin: "https://example.invalid" },
            )
          ).status,
          403,
        );
      }
      assert.equal((await get()).state.records.length, 0);
      await command({
        action: "record.create",
        title: "Transport confirmation",
        kind: "milestone",
        domain: "coordination",
        owner_id: staff[2].id,
        value: "Awaiting written confirmation",
      });
      let state = await get();
      const recordId = state.state.records[0].id;
      await command({ action: "record.confirm", id: recordId }, staff[0], 403);
      await command({ action: "record.confirm", id: recordId }, staff[2]);
      await command(
        {
          action: "proposal.create",
          record_id: recordId,
          base_version: 2,
          value: "Written confirmation received",
        },
        staff[0],
      );
      await command(
        {
          action: "proposal.create",
          record_id: recordId,
          base_version: 2,
          value: "Second unreviewed claim",
        },
        staff[0],
      );
      state = await get();
      assert.equal(
        state.state.records[0].value,
        "Awaiting written confirmation",
      );
      await command(
        { action: "proposal.accept", id: state.state.proposals[0].id },
        staff[2],
      );
      await command(
        { action: "proposal.accept", id: state.state.proposals[1].id },
        staff[2],
        409,
      );
      assert.equal(
        (await request(api, staff[0], { action: "record.create", revision: 0 }))
          .status,
        409,
      );
      await command({
        action: "record.create",
        title: "Unresolved financial evidence",
        kind: "fact",
        domain: "finance",
        owner_id: staff[3].id,
        value: "Not confirmed",
      });
      await command({
        action: "commitment.request",
        title: "Compare the working schedule with the source",
        owner_id: staff[2].id,
      });
      state = await get();
      const cid = state.state.commitments[0].id;
      await command(
        { action: "commitment.transition", id: cid, status: "accepted" },
        staff[0],
        403,
      );
      await command(
        { action: "commitment.transition", id: cid, status: "accepted" },
        staff[2],
      );
      await command(
        {
          action: "commitment.transition",
          id: cid,
          status: "waiting",
          dependency: "Waiting for corrected source",
        },
        staff[2],
      );
      const standardDoc = unzipSync(
        readFileSync(
          new URL("./fixtures/carnegie-workspace/plan.docx", import.meta.url),
        ),
      );
      standardDoc["word/document.xml"] = strToU8(
        strFromU8(standardDoc["word/document.xml"]).replace(
          "Synthetic coordination plan",
          "Sample working plan &lt;script&gt;alert(1)&lt;/script&gt;",
        ),
      );
      const docBytes = zipSync(standardDoc);
      const upload = () =>
        fetch(
          base +
            api +
            `/files?name=Sample.docx&source=Synthetic%20fixture&revision=${current.revision}`,
          {
            method: "POST",
            headers: {
              Cookie: cookie(staff[2]),
              Origin: base,
              "X-Reviewed-Content": "yes",
              "Content-Type": "application/octet-stream",
            },
            body: docBytes,
          },
        );
      const up = await upload();
      assert.equal(up.status, 200, await up.clone().text());
      const did = (await up.json()).id;
      await command(
        { action: "document.status", id: did, status: "current" },
        staff[0],
        403,
      );
      await command(
        { action: "document.status", id: did, status: "current" },
        staff[2],
      );
      const file = await request(api + "/files?id=" + did, staff[2]);
      assert.equal(file.status, 200);
      assert.deepEqual(
        Buffer.from(await file.arrayBuffer()),
        Buffer.from(docBytes),
      );
      const pack = await request(api + "/package", staff[2]);
      assert.equal(pack.status, 200, await pack.clone().text());
      const entries = unzipSync(new Uint8Array(await pack.arrayBuffer()));
      const exported = JSON.parse(strFromU8(entries["workspace.json"]));
      assert.ok(!JSON.stringify(exported).includes("session_token"));
      assert.ok(!JSON.stringify(exported).includes("object_key"));
      assert.equal(exported.state.commitments[0].status, "waiting");
      assert.ok(Object.keys(entries).some((k) => k.startsWith("documents/")));
      const historyResponse = await request(api + "?revision=1", staff[2]);
      assert.equal(historyResponse.status, 200);
      const snapshot = await historyResponse.json();
      assert.equal(snapshot.revision, 1);
      assert.ok(!JSON.stringify(snapshot).includes("object_key"));
      const before = rpcCount;
      const importResponse = await request(api + "/import", staff[2], {
        format: "carnegie-proposals-v1",
        revision: current.revision,
        proposals: [
          {
            record_id: recordId,
            base_version: 3,
            value: "Package update",
            source: "Synthetic package",
          },
        ],
      });
      assert.equal(importResponse.status, 200);
      assert.equal(rpcCount, before + 1);
      // Race two saves against the same revision. Exactly one succeeds.
      const race = {
        action: "commitment.request",
        title: "Concurrent request",
        owner_id: staff[2].id,
        source: "Synthetic concurrency test",
        revision: current.revision,
      };
      const raced = await Promise.all([
        request(api, staff[2], race),
        request(api, staff[2], race),
      ]);
      assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
      // Two isolated local-agent configurations exercise the distributed client.
      const configs = [];
      for (const person of [staff[0], staff[2]]) {
        const created = await request(api + "/agent-access", person, { action: "create", label: "Synthetic local agent" });
        assert.equal(created.status, 200, await created.clone().text());
        const { workspace_key: token } = await created.json();
        const config = join(output, `agent-${person.id}.json`);
        await writeFile(config, JSON.stringify({url: base + api + "/agent", token}), {mode: 0o600});
        configs.push({config, token});
      }
      async function client(index, payload) {
        const c = spawn(process.execPath, ["public/tools/carnegie-agent.mjs", payload ? "write" : "read"], {env: {...process.env, CARNEGIE_AGENT_CONFIG: configs[index].config}, stdio: ["pipe", "pipe", "pipe"]});
        let out = "", err = "";
        c.stdout.on("data", d => out += d); c.stderr.on("data", d => err += d);
        c.stdin.end(payload ? JSON.stringify(payload) : undefined);
        const [code] = await once(c, "close");
        return {code, out, err};
      }
      const initial = JSON.parse((await client(0)).out);
      assert.equal(initial.actor.id, staff[0].id);
      assert.equal("documents" in initial.state, false);
      const addition = { action: "coordination.save", kind: "reported_decision", title: "Shared decision report", value: "Prepare the agreed outline", attributed_to: "Sample Director", occurred_on: "2026-09-11", source: "Synthetic dated conversation", team_visible: true, revision: initial.revision };
      assert.equal((await client(1, addition)).code, 0);
      assert.match((await client(0, addition)).err, /409/);
      let latest = JSON.parse((await client(0)).out);
      const entry = latest.state.records.find(r => r.title === addition.title);
      assert.equal(entry.created_by, staff[2].id);
      assert.equal(entry.status, "reported");
      assert.equal((await client(0, {...addition, id: entry.id, base_version: entry.version, revision: latest.revision, value: "Outline prepared"})).code, 0);
      const shared = await request(api, staff[5]);
      assert.equal(shared.status, 200);
      const visible = await shared.json();
      assert.equal(visible.team.length, 1);
      assert.equal(visible.team[0].value, "Outline prepared");
      for (const key of ["state", "history", "people"]) assert.equal(key in visible, false);
      assert.equal("source" in visible.team[0], false);
      for (const path of [api + "?revision=1", api + "/files?id=missing", api + "/package", api + "/agent-access"])
        assert.equal((await request(path, staff[5])).status, 403);
      for (const path of [api, api + "/files", api + "/import", api + "/agent-access"])
        assert.equal((await request(path, staff[5], {})).status, 403);
      assert.equal((await request(api + "/agent", staff[0])).status, 401);
      assert.equal((await request(api, null, undefined, { Authorization: `Bearer ${configs[0].token}` })).status, 401);
      latest = JSON.parse((await client(1)).out);
      assert.match((await client(1, { action: "document.receive", revision: latest.revision, source: "Synthetic source" })).err, /403/);
      const listing = await (await request(api + "/agent-access", staff[2])).json();
      assert.equal("token_hash" in listing.keys[0], false);
      assert.equal("token" in listing.keys[0], false);
      await request(api + "/agent-access", staff[0], {action: "revoke", id: listing.keys[0].id});
      assert.equal((await client(1)).code, 0); // cannot revoke another writer's key
      await request(api + "/agent-access", staff[2], {action: "revoke", id: listing.keys[0].id});
      assert.match((await client(1)).err, /401/);
      const member = members.find(m => m.staff_id === staff[2].id);
      const fresh = await (await request(api + "/agent-access", staff[2], {action: "create", label: "Membership test"})).json();
      member.access = "viewer";
      assert.equal((await request(api + "/agent", null, undefined, {Authorization: `Bearer ${fresh.workspace_key}`})).status, 403);
      assert.equal((await request(api + "/agent-access", staff[2], {action: "create", label: "Denied"})).status, 403);
      member.access = "writer";
      const primaryKey = agentKeys.find(k => k.staff_id === staff[0].id);
      const expiry = primaryKey.expires_at;
      primaryKey.expires_at = "2020-01-01T00:00:00Z";
      assert.match((await client(0)).err, /401/);
      primaryKey.expires_at = expiry;
      staff[0].disabled_at = new Date().toISOString();
      assert.match((await client(0)).err, /401/);
      staff[0].disabled_at = null;
      const playwrightRoot = process.env.PLAYWRIGHT_MODULE;
      if (playwrightRoot) {
        const { chromium } = require(playwrightRoot);
        browser = await chromium.launch({ headless: true });
        const entryContext = await browser.newContext();
        const entry = await entryContext.newPage();
        const entryErrors = [];
        entry.on("pageerror", (error) => entryErrors.push(error.message));
        await entry.goto(base + "/carnegie-2027/team");
        await entry
          .getByRole("heading", { name: "Sign in to the Carnegie workspace" })
          .waitFor();
        await entry.getByRole("link", { name: "Sign in", exact: true }).click();
        await entry.waitForURL(base + "/carnegie-2027/team/sign-in");
        await entry.getByLabel("Email", { exact: true }).fill(staff[0].email);
        await entry.getByLabel("PIN", { exact: true }).fill("000000");
        await entry
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
        await entry
          .getByText("Email or PIN not recognized", { exact: true })
          .waitFor();
        assert.ok(entry.url().endsWith("/sign-in"));
        await entry.route("**/api/sponsors/staff-auth", (route) =>
          route.abort(),
        );
        await entry
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
        await entry
          .getByText("Staff sign-in could not connect. Please try again.", {
            exact: true,
          })
          .waitFor();
        await entry.unroute("**/api/sponsors/staff-auth");
        await entry.getByLabel("PIN", { exact: true }).fill("246810");
        await entry
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
        await entry.waitForURL(base + "/carnegie-2027/team");
        await entry
          .getByRole("heading", { name: "Carnegie, together." })
          .waitFor();
        assert.ok(
          (await entryContext.cookies()).find(
            (c) => c.name === "ab_staff_session",
          )?.httpOnly,
        );
        await entry.evaluate(() =>
          localStorage.removeItem("bdos_staff_session_v1"),
        );
        await entry.reload();
        await entry
          .getByRole("heading", { name: "Carnegie, together." })
          .waitFor();
        await entry.route("**/api/carnegie-2027/team", (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Synthetic temporary outage" }),
          }),
        );
        await entry.reload();
        await entry
          .getByRole("heading", { name: "Workspace temporarily unavailable" })
          .waitFor();
        await entry.unroute("**/api/carnegie-2027/team");
        await entry
          .getByRole("button", { name: "Try again", exact: true })
          .click();
        await entry
          .getByRole("heading", { name: "Carnegie, together." })
          .waitFor();
        await entryContext.clearCookies();
        await entry.evaluate(() =>
          localStorage.setItem(
            "bdos_staff_session_v1",
            JSON.stringify({ id: "stale-display", role: "director" }),
          ),
        );
        await entry
          .getByRole("button", { name: "Refresh", exact: true })
          .click();
        await entry
          .getByRole("heading", { name: "Sign in to the Carnegie workspace" })
          .waitFor();
        assert.equal(
          await entry
            .getByRole("button", { name: "Try again", exact: true })
            .count(),
          0,
        );
        await entry.reload();
        await entry
          .getByRole("link", { name: "Sign in", exact: true })
          .waitFor();
        await entry.screenshot({
          path: join(output, "expired-session.png"),
          fullPage: true,
        });
        await entryContext.addCookies([
          {
            name: "ab_staff_session",
            value: cookie(staff[1]).split("=")[1],
            url: base,
          },
        ]);
        await entry.reload();
        await entry
          .getByRole("heading", {
            name: "This account does not have workspace access",
          })
          .waitFor();
        await entry
          .getByRole("link", {
            name: "Sign in with another account",
            exact: true,
          })
          .click();
        await entry.waitForURL(base + "/carnegie-2027/team/sign-in");
        await entry.getByLabel("Email", { exact: true }).fill(staff[0].email);
        await entry.getByLabel("PIN", { exact: true }).fill("246810");
        await entry
          .getByRole("button", { name: "Sign In", exact: true })
          .click();
        await entry.waitForURL(base + "/carnegie-2027/team");
        await entry
          .getByRole("heading", { name: "Carnegie, together." })
          .waitFor();
        assert.deepEqual(entryErrors, []);
        await entryContext.close();
        const context = await browser.newContext();
        await context.addCookies([
          {
            name: "ab_staff_session",
            value: cookie(staff[2]).split("=")[1],
            url: base,
          },
        ]);
        await context.addInitScript(
          (value) =>
            localStorage.setItem(
              "bdos_staff_session_v1",
              JSON.stringify(value),
            ),
          {
            id: staff[2].id,
            role: staff[2].role,
            display_name: staff[2].display_name,
          },
        );
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(base + "/carnegie-2027/team");
        await page
          .getByRole("heading", { name: "Carnegie, together." })
          .waitFor();
        await page.getByLabel("Title", {exact: true}).fill("Browser progress update");
        await page.getByLabel("Update and next action", {exact: true}).fill("Follow up with the team next week.");
        await page.getByLabel("Source and date", {exact: true}).fill("Synthetic browser test");
        await page.getByRole("button", {name: "Save coordination entry", exact: true}).click();
        await page.getByRole("heading", {name: "Browser progress update", exact: true}).waitFor();
        await page.getByRole("button", {name: "Connect agent", exact: true}).click();
        await page.getByRole("heading", {name: "Connect your agent"}).waitFor();
        await page.getByLabel("Agent name", {exact: true}).fill("Browser local agent");
        await page.getByRole("button", {name: "Create my connection", exact: true}).click();
        await page.getByRole("button", {name: "Save private connection file"}).waitFor();
        await page.getByRole("button", {name: "Coordination", exact: true}).click();
        await page.screenshot({
          path: join(output, "desktop.png"),
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Documents", exact: true })
          .click();
        await page.getByText(/Latest received · Current working/).click();
        await page
          .getByText("Document text and tables", { exact: true })
          .click();
        await page.getByText(/Sample working plan <script>/).waitFor();
        await page.screenshot({
          path: join(output, "documents.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page
          .getByRole("button", { name: "My attention", exact: true })
          .click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: join(output, "phone.png"),
          fullPage: true,
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          true,
        );
        await page.getByRole("button", {name: "Coordination", exact: true}).click();
        await page.screenshot({path: join(output, "coordination-phone.png"), fullPage: true});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        const viewerContext = await browser.newContext({viewport: {width: 390, height: 844}});
        await viewerContext.addCookies([{name: "ab_staff_session", value: cookie(staff[5]).split("=")[1], url: base}]);
        const viewerPage = await viewerContext.newPage();
        await viewerPage.goto(base + "/carnegie-2027/team");
        await viewerPage.getByText("Read-only team access", {exact: true}).waitFor();
        await viewerPage.getByRole("heading", {name: "Shared decision report", exact: true}).waitFor();
        assert.equal(await viewerPage.getByRole("button", {name: "Download working package"}).count(), 0);
        assert.equal(await viewerPage.getByRole("heading", {name: "Browser progress update", exact: true}).count(), 0);
        await viewerPage.screenshot({path: join(output, "viewer-phone.png"), fullPage: true});
        await viewerContext.close();
        assert.deepEqual(errors, []);
        await browser.close();
        browser = null;
      }
      console.log(`Synthetic HTTP/UI proof passed; screenshots: ${output}`);
    } finally {
      await browser?.close();
      child.kill("SIGTERM");
      await once(child, "close");
      backend.close();
      await writeFile(join(output, "next.log"), log);
    }
  },
);
