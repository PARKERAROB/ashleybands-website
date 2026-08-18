#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { bandWebsiteRoot } from "./lib/workspace-paths.mjs";

const EXPECTED_PROJECT_REF = "edcmfzxqtdbgygeimedo";
const projectRefFile = path.join(bandWebsiteRoot, "supabase", ".temp", "project-ref");

if (!existsSync(projectRefFile)) {
  console.error("Supabase is not linked. Link the AshleyBands production project first.");
  process.exit(1);
}

const projectRef = readFileSync(projectRefFile, "utf8").trim();
if (projectRef !== EXPECTED_PROJECT_REF) {
  console.error(`Refusing Supabase command: linked to ${projectRef}, expected ${EXPECTED_PROJECT_REF}.`);
  process.exit(1);
}

// .env.local once contained an expired token for a different Supabase account.
// Removing it makes the CLI use its authenticated profile for the linked project.
const { SUPABASE_ACCESS_TOKEN: _ignored, ...safeEnv } = process.env;
const result = spawnSync("npx", ["supabase", ...process.argv.slice(2)], {
  cwd: bandWebsiteRoot,
  env: safeEnv,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
