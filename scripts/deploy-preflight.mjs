#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  bandWebsiteRoot,
  loadBandWebsiteEnv,
} from "./lib/workspace-paths.mjs";

const EXPECTED_AUTHOR_EMAIL = "robert.parker@nhcs.net";
const EXPECTED_PROJECT_ID = "prj_zt07T3fHc75OimXD3SnBoP4JcQzr";
const EXPECTED_ORG_ID = "team_iJ1ikB48QN8eYHbQunrskJuf";
const EXPECTED_SUPABASE_REF = "edcmfzxqtdbgygeimedo";

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

function git(...args) {
  const result = spawnSync("git", args, {
    cwd: bandWebsiteRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) fail(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

const branch = git("branch", "--show-current");
if (branch !== "main") fail(`production deploys must run from main; found ${branch || "detached HEAD"}`);

const authorEmail = git("log", "-1", "--format=%ae").toLowerCase();
if (authorEmail !== EXPECTED_AUTHOR_EMAIL) {
  fail(
    `Vercel will block this HEAD author (${authorEmail || "missing"}). ` +
      `Create the narrow Rob authorization commit with ${EXPECTED_AUTHOR_EMAIL}.`
  );
}

const projectFile = path.join(bandWebsiteRoot, ".vercel", "project.json");
if (!existsSync(projectFile)) fail("missing .vercel/project.json; run vercel link for band-website");
const project = JSON.parse(readFileSync(projectFile, "utf8"));
if (project.projectId !== EXPECTED_PROJECT_ID || project.orgId !== EXPECTED_ORG_ID) {
  fail("Vercel is linked to the wrong project or team; expected robs-projects-9eb69de7/band-website");
}

const supabaseRefFile = path.join(bandWebsiteRoot, "supabase", ".temp", "project-ref");
if (existsSync(supabaseRefFile)) {
  const linkedRef = readFileSync(supabaseRefFile, "utf8").trim();
  if (linkedRef !== EXPECTED_SUPABASE_REF) {
    fail(`Supabase is linked to ${linkedRef}; expected ${EXPECTED_SUPABASE_REF}`);
  }
}

loadBandWebsiteEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
try {
  const parsed = new URL(supabaseUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== `${EXPECTED_SUPABASE_REF}.supabase.co`) {
    fail(`NEXT_PUBLIC_SUPABASE_URL does not point to ${EXPECTED_SUPABASE_REF}`);
  }
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a valid production URL");
}
if (!publishableKey) fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing");

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/portal_students?select=id&limit=1`, {
    headers: { apikey: publishableKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail(`production Supabase REST health check returned HTTP ${response.status}`);
} catch (error) {
  fail(
    `production Supabase REST health check failed (${error.name || error.message}). ` +
      "Do not deploy while PostgREST is unhealthy; check the Nano Disk IO budget."
  );
}

const vercel = spawnSync(
  "npx",
  ["--yes", "vercel@59.1.4", "whoami"],
  { cwd: bandWebsiteRoot, encoding: "utf8" }
);
if (vercel.status !== 0 || vercel.stdout.trim() !== "robertparker-6198") {
  fail("Vercel CLI is not authenticated as robertparker-6198");
}

console.log("PASS  production deployment preflight");
console.log("PASS  main HEAD carries the verified Vercel author identity");
console.log("PASS  Vercel and Supabase links point to the AshleyBands production projects");
console.log("PASS  production Supabase REST is responding");
