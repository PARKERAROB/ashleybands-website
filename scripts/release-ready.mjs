#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { bandWebsiteRoot, bandWebsiteEnvPath, bandsofAHSRoot } from "./lib/workspace-paths.mjs";
function fail(message) { throw new Error(message); }
function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (result.status !== 0) fail(`git ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}
try {
  process.chdir(bandWebsiteRoot);
  const required = readFileSync(".nvmrc", "utf8").trim();
  if (process.version !== `v${required}`) fail("Run through npm run release:checked or bash scripts/runtime.sh <command> to select .nvmrc.");
  if (!existsSync("node_modules") || lstatSync("node_modules").isSymbolicLink()) fail("Run npm run setup:checkout; dependencies must be installed inside this checkout.");
  if (!existsSync(bandWebsiteEnvPath) || !existsSync(".env.local")) fail("Missing local environment. Provision the ignored .env.local from the trusted local environment; never print or commit its contents.");
  if (!existsSync(path.join(bandsofAHSRoot, "data/calendar-events.jsonl"))) fail("Set BANDSOFAHS_DIR to the canonical BandsofAHS checkout.");
  if (!existsSync(".vercel/project.json")) fail("Missing Vercel link. Run bash scripts/runtime.sh npx --yes vercel@59.1.4 link --yes --scope parkerarob --project band-website.");
  const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
  if (project.projectId !== "prj_zt07T3fHc75OimXD3SnBoP4JcQzr" || project.orgId !== "team_iJ1ikB48QN8eYHbQunrskJuf") fail("Wrong Vercel project/team link; relink to band-website.");
  if (!process.argv.includes("--setup")) {
    if (git("branch", "--show-current") !== "main") fail("Release from main after integrating the intended change.");
    if (git("status", "--porcelain")) fail("Working tree changed: commit intended files before release; preserve unrelated work.");
    if (git("log", "-1", "--format=%ae").toLowerCase() !== "robert.parker@nhcs.net") fail("Prepare the narrow Rob-authored authorization commit before release (docs/RELEASING.md).");
    if (!/^Checked:[ \t]*\S/m.test(git("log", "-1", "--format=%B"))) fail("Authorization commit needs a 'Checked: <one line of what you actually verified>' trailer so the authorize pairing is evidence of review, not a reflex (docs/RELEASING.md; workshop#121).");
    const projection = spawnSync(process.execPath, ["scripts/build-regiment-os-review.mjs", "--check"], { encoding: "utf8" });
    if (projection.status !== 0) fail("Regiment OS projection does not match local source/key. Check issue #46 and docs/RELEASING.md before rebuilding; do not commit an unverified encrypted replacement.");
    git("fetch", "origin", "refs/heads/main:refs/remotes/origin/main");
    if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) fail("HEAD differs from freshly fetched origin/main. Integrate remote changes and push before retrying.");
  }
  console.log("PASS  checkout readiness");
} catch (error) { console.error(`Readiness blocked: ${error.message}`); process.exitCode = 1; }
