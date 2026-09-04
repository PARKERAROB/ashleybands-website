#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const PROJECT = "band-website";
const TEAM = "robs-projects-9eb69de7";
const DOMAIN = "ashleybands.com";
const IDENTITY_MARKER = "<title>Bands of AHS</title>";
const VERCEL = ["npx", "--yes", "vercel@59.1.4"];

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  return value;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) fail(result.stderr.trim() || `${command} failed`);
  return result.stdout.trim();
}

const expectedCommit = option("--expected-commit");
const notBeforeOption = option("--not-before");
const notBefore = notBeforeOption === null ? null : Number(notBeforeOption);
if (notBeforeOption !== null && !Number.isFinite(notBefore)) fail("--not-before must be epoch milliseconds");

if (expectedCommit) {
  const head = run("git", ["rev-parse", "HEAD"]);
  if (head !== expectedCommit) fail(`local HEAD ${head} does not match expected commit ${expectedCommit}`);
  if (run("git", ["status", "--porcelain"])) fail("working tree is not clean for commit-bound live verification");
}

const [vercelCommand, ...vercelPrefix] = VERCEL;
let deployment;
try {
  deployment = JSON.parse(run(vercelCommand, [
    ...vercelPrefix,
    "inspect",
    `https://${DOMAIN}`,
    "--json",
    "--scope",
    TEAM,
  ]));
} catch (error) {
  fail(`could not parse Vercel inspection: ${error.message}`);
}

if (deployment.name !== PROJECT) fail(`production alias points to ${deployment.name || "an unknown project"}, not ${PROJECT}`);
if (deployment.target !== "production") fail(`production alias resolved to target ${deployment.target || "unknown"}`);
if (deployment.readyState !== "READY") fail(`deployment ${deployment.id || "unknown"} is ${deployment.readyState || "unknown"}`);
if (!deployment.aliases?.includes(DOMAIN)) fail(`${DOMAIN} is not an alias of deployment ${deployment.id || "unknown"}`);
if (notBefore !== null && Number(deployment.createdAt) + 30_000 < notBefore) {
  fail(`deployment ${deployment.id || "unknown"} predates this release attempt`);
}
if (expectedCommit && deployment.meta?.validationCommit !== expectedCommit) {
  fail(`deployment metadata is not bound to expected commit ${expectedCommit}`);
}

let response;
try {
  response = await fetch(`https://${DOMAIN}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
} catch (error) {
  fail(`${DOMAIN} request failed: ${error.message}`);
}
if (response.status !== 200) fail(`${DOMAIN} returned HTTP ${response.status}`);
const body = await response.text();
if (!body.includes(IDENTITY_MARKER)) fail(`${DOMAIN} did not return the expected AshleyBands identity marker`);

console.log(`PASS  ${DOMAIN} is READY on Vercel deployment ${deployment.id}`);
console.log("PASS  public HTTP response and AshleyBands identity marker");
console.log(`PROOF ${JSON.stringify({
  commit: expectedCommit,
  deployment_id: deployment.id,
  domain: DOMAIN,
  observed_at: new Date().toISOString(),
})}`);
