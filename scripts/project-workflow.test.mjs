import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "PROJECT_WORKFLOW.md",
  "docs/HOW_TO_REQUEST_A_CHANGE.md",
  ".github/ISSUE_TEMPLATE/change.yml",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/copilot-instructions.md",
];

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical workflow artifacts exist and are not empty", async () => {
  for (const path of requiredFiles) {
    const content = await read(path);
    assert.ok(content.trim().length > 0, `${path} must not be empty`);
  }
});

test("every repository agent entrypoint requires the canonical workflow", async () => {
  for (const path of ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]) {
    const content = await read(path);
    assert.match(content, /PROJECT_WORKFLOW\.md/, `${path} must point to PROJECT_WORKFLOW.md`);
    assert.match(content, /[Bb]efore .*work|[Bb]efore .*acting/, `${path} must require the read before work`);
  }
});

test("workflow preserves the public-repository privacy boundary", async () => {
  const workflow = await read("PROJECT_WORKFLOW.md");
  assert.match(workflow, /repository is public/);
  assert.match(workflow, /Never place student or family identities/);

  for (const path of [
    ".github/ISSUE_TEMPLATE/change.yml",
    ".github/ISSUE_TEMPLATE/bug.yml",
  ]) {
    const template = await read(path);
    assert.match(template, /Keep this public issue sanitized/);
  }
});

test("the repository exposes the shared validation and checked-release contract", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const releaseScript = await read("scripts/release-checked.sh");
  const liveScript = await read("scripts/verify-live.mjs");

  for (const command of ["verify:change", "verify:release", "verify:live", "release:checked"]) {
    assert.ok(packageJson.scripts[command], `missing npm run ${command}`);
  }
  assert.equal(packageJson.scripts["deploy:checked"], "npm run release:checked");
  assert.match(releaseScript, /--meta "validationCommit=\$released_sha"/);
  assert.match(releaseScript, /verify:live -- --expected-commit/);
  assert.match(liveScript, /deployment\.meta\?\.validationCommit !== expectedCommit/);
  assert.match(liveScript, /<title>Bands of AHS<\/title>/);
});
