import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const verifier = fileURLToPath(new URL("./verify-live.mjs", import.meta.url));
const commit = "a".repeat(40);
const inspection = {
  id: "dpl_test123", name: "band-website", target: "production",
  readyState: "READY", aliases: ["ashleybands.com"], createdAt: 100000,
};

function verify(metadata, overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "ashley-release-proof-"));
  try {
    const cli = `#!${process.execPath}\nconst args=process.argv.slice(2);\nif(args.includes('inspect'))process.stdout.write(process.env.TEST_INSPECT);\nelse if(args.includes('api') && args.includes('/v13/deployments/dpl_test123'))process.stdout.write(process.env.TEST_METADATA);\nelse process.exit(2);\n`;
    writeFileSync(path.join(dir, "npx"), cli, { mode: 0o755 });
    writeFileSync(path.join(dir, "git"), `#!${process.execPath}\nif(process.argv.includes('rev-parse'))process.stdout.write('${commit}');\n`, { mode: 0o755 });
    writeFileSync(path.join(dir, "fetch.mjs"), 'globalThis.fetch = async () => new Response("<title>Bands of AHS</title>");\n');
    return spawnSync(process.execPath, ["--import", path.join(dir, "fetch.mjs"), verifier, "--expected-commit", commit, "--not-before", "100000"], {
      env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, TEST_INSPECT: JSON.stringify({ ...inspection, ...overrides }), TEST_METADATA: JSON.stringify(metadata) },
      encoding: "utf8", timeout: 15000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("release verification reads API metadata when the CLI summary omits it", () => {
  const result = verify({ id: inspection.id, meta: { validationCommit: commit } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PROOF/);
});

test("release verification rejects missing or wrong commit metadata", () => {
  for (const meta of [undefined, {}, { validationCommit: "wrong" }]) {
    const result = verify({ id: inspection.id, meta });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /metadata is not bound/);
  }
});

test("release verification rejects metadata from another deployment", () => {
  const result = verify({ id: "dpl_other", meta: { validationCommit: commit } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /different deployment/);
});

test("release verification still rejects stale deployments and wrong aliases", () => {
  const metadata = { id: inspection.id, meta: { validationCommit: commit } };
  assert.match(verify(metadata, { createdAt: 1 }).stderr, /predates this release/);
  assert.match(verify(metadata, { aliases: [] }).stderr, /not an alias/);
});
