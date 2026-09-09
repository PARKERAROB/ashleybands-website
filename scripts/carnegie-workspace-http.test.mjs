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
const members = [
  { staff_id: staff[2].id, domains: ["coordination"] },
  { staff_id: staff[3].id, domains: ["finance"] },
];
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
      if (u.pathname === "/rest/v1/staff") {
        const rows = filter(staff).map(({ session_token, ...s }) =>
          u.searchParams.get("select")?.includes("session_token")
            ? { ...s, session_token }
            : s,
        );
        return send(
          u.searchParams.has("id") && u.searchParams.get("id").startsWith("eq.")
            ? rows[0] || null
            : rows,
        );
      }
      if (u.pathname === "/rest/v1/carnegie_workspace_members") {
        const rows = filter(members);
        return send(u.searchParams.has("staff_id") ? rows[0] || null : rows);
      }
      if (u.pathname === "/rest/v1/carnegie_workspace") return send(current);
      if (u.pathname === "/rest/v1/carnegie_workspace_history")
        return send(u.searchParams.has("revision") ? history.find(h => String(h.revision) === u.searchParams.get("revision").slice(3)) : [...history].reverse().slice(0, 100));
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
      const docBytes = zipSync({
        "word/document.xml": strToU8(
          '<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>Sample working plan &lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p></w:body></w:document>',
        ),
      });
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
      const playwrightRoot = process.env.PLAYWRIGHT_MODULE;
      if (playwrightRoot) {
        const { chromium } = require(playwrightRoot);
        browser = await chromium.launch({ headless: true });
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
