#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  bandsofAHSRoot,
  bandWebsiteEnvPath,
  bandWebsiteRoot,
} from "./lib/workspace-paths.mjs";

const mode = process.argv[2] || "doctor";
const online = process.argv.includes("--online");
const deployMode = process.argv.includes("--deploy");
const portalApply = process.argv.includes("--portal-apply");

const calendarScript = path.join(bandsofAHSRoot, "scripts", "render_calendar.py");
const siteDatesScript = path.join(
  bandsofAHSRoot,
  ".claude",
  "skills",
  "check-site-dates",
  "scripts",
  "check_site_dates.py"
);

let failures = 0;
let warnings = 0;

function report(kind, label, detail = "") {
  const mark = kind === "pass" ? "PASS" : kind === "warn" ? "WARN" : "FAIL";
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (kind === "warn") warnings += 1;
  if (kind === "fail") failures += 1;
}

function run(label, command, args, { warnOnly = false, quiet = true } = {}) {
  const result = spawnSync(command, args, {
    cwd: bandWebsiteRoot,
    encoding: "utf8",
    env: process.env,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (result.status === 0) {
    const finalLine = output.split("\n").filter(Boolean).at(-1) || "ok";
    report("pass", label, finalLine);
    if (!quiet && output) console.log(output);
    return true;
  }
  report(warnOnly ? "warn" : "fail", label, output.split("\n").filter(Boolean).at(-1) || `exit ${result.status}`);
  if (output) console.log(output);
  return false;
}

function walk(root) {
  const files = [];
  if (!existsSync(root)) return files;
  for (const entry of readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function checkPrivacyBoundary() {
  const tracked = spawnSync("git", ["ls-files"], {
    cwd: bandWebsiteRoot,
    encoding: "utf8",
  });
  if (tracked.status !== 0) {
    report("fail", "public repository privacy boundary", "could not list tracked files");
    return;
  }
  const forbiddenTracked = tracked.stdout.split("\n").filter((file) => {
    const name = path.basename(file).toLowerCase();
    return (
      name === ".env" ||
      (name.startsWith(".env.") && name !== ".env.example") ||
      ["students.csv", "parents.csv", "people.jsonl"].includes(name)
    );
  });

  const runtimeRoots = ["app", "components", "lib", "scripts"].map((dir) =>
    path.join(bandWebsiteRoot, dir)
  );
  const contactsReferences = runtimeRoots
    .flatMap(walk)
    .filter((file) => /\.(?:js|jsx|mjs|ts|tsx)$/.test(file))
    .filter((file) => file !== path.join(bandWebsiteRoot, "scripts", "integration.mjs"))
    .filter((file) => /Contacts\/people\.jsonl|Atlas\/Contacts/.test(readFileSync(file, "utf8")));

  if (forbiddenTracked.length || contactsReferences.length) {
    report(
      "fail",
      "public repository privacy boundary",
      `${forbiddenTracked.length} forbidden tracked files; ${contactsReferences.length} Contacts runtime references`
    );
  } else {
    report("pass", "public repository privacy boundary", "no private roster/contact stores tracked or imported");
  }
}

async function checkLiveCalendar() {
  try {
    const response = await fetch("https://ashleybands.com/calendar.ics", {
      signal: AbortSignal.timeout(15_000),
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const live = Buffer.from(await response.arrayBuffer());
    const local = readFileSync(path.join(bandWebsiteRoot, "public", "calendar.ics"));
    if (live.equals(local)) report("pass", "live calendar", "ashleybands.com matches the local projection");
    else report("fail", "live calendar", "local projection has not been deployed");
  } catch (error) {
    report("fail", "live calendar", error.message);
  }
}

async function doctor() {
  console.log("AshleyBands website integration doctor\n");

  if (!existsSync(bandsofAHSRoot) || !existsSync(calendarScript)) {
    report("fail", "workspace layout", `BandsofAHS not found at ${bandsofAHSRoot}`);
  } else {
    report("pass", "workspace layout", "BandsofAHS and band-website resolved without machine-specific paths");
  }

  run("calendar safety tests", "python3", [calendarScript, "--selftest"]);
  run("calendar projections", "python3", [calendarScript, "--check"]);
  run("public content projection", process.execPath, ["scripts/build-public-content.mjs", "--check"]);
  run("Regiment OS projection", process.execPath, ["scripts/build-regiment-os-review.mjs", "--check"]);
  run("instrument projection", process.execPath, ["scripts/build-instruments-public.mjs", "--check"]);
  run("data provenance lint", process.execPath, ["scripts/provenance-lint.mjs"]);
  checkPrivacyBoundary();

  run(
    "portal source parse",
    process.execPath,
    ["scripts/sync-portal-csv.mjs", "--summary"],
    { quiet: true }
  );
  if (existsSync(bandWebsiteEnvPath)) {
    run(
      "hosted portal mirror",
      process.execPath,
      ["scripts/sync-portal-csv.mjs", "--check", "--summary"],
      { warnOnly: deployMode || (mode === "sync" && !portalApply) }
    );
  } else {
    report("warn", "hosted portal mirror", "no .env.local; remote drift check skipped");
  }

  if (existsSync(siteDatesScript)) {
    run(
      "published date cross-check",
      "python3",
      [
        siteDatesScript,
        "--site-data",
        path.join(bandWebsiteRoot, "content", "site-data.json"),
        "--calendar",
        path.join(bandsofAHSRoot, "data", "calendar-2026.csv"),
      ],
      { warnOnly: true }
    );
  }
  if (online) await checkLiveCalendar();

  console.log(`\nResult: ${failures} failure(s), ${warnings} warning(s)`);
  return failures === 0 ? 0 : 1;
}

async function sync() {
  console.log("AshleyBands website integration sync\n");
  if (!run("calendar safety tests", "python3", [calendarScript, "--selftest"])) return 1;
  if (!run("calendar write", "python3", [calendarScript, "--write"])) return 1;
  if (!run("public content write", process.execPath, ["scripts/build-public-content.mjs"])) return 1;
  if (!run("Regiment OS write", process.execPath, ["scripts/build-regiment-os-review.mjs"])) return 1;
  if (!run("instrument write", process.execPath, ["scripts/build-instruments-public.mjs"])) return 1;

  if (portalApply) {
    if (!run("portal apply", process.execPath, ["scripts/sync-portal-csv.mjs", "--apply", "--summary"], { quiet: false })) {
      return 1;
    }
  } else {
    console.log("INFO  hosted portal was not written; add --portal-apply only after reviewing roster drift");
  }
  console.log("");
  return doctor();
}

if (!["doctor", "sync"].includes(mode)) {
  console.error("Usage: node scripts/integration.mjs doctor [--online|--deploy]");
  console.error("       node scripts/integration.mjs sync [--portal-apply]");
  process.exit(2);
}

process.exitCode = mode === "sync" ? await sync() : await doctor();
