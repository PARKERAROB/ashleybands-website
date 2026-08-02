#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {
  bandWebsiteRoot,
  bandsofAHSRoot,
  loadBandWebsiteEnv
} from "./lib/workspace-paths.mjs";

const checkOnly = process.argv.includes("--check");
const sourceRoot = path.join(
  bandsofAHSRoot,
  "projects",
  "marching-band",
  "regiment-os"
);
const outputPath = path.join(bandWebsiteRoot, "content", "regiment-os-review.encrypted.json");

const documents = [
  {
    slug: "start-here",
    file: "README.md",
    title: "Start here",
    summary: "What Regiment OS is, how to read it, and what is still unfrozen."
  },
  {
    slug: "charter",
    file: "charter.md",
    title: "Charter",
    summary: "Why the system exists and what it is trying to make possible."
  },
  {
    slug: "roles",
    file: "roles.md",
    title: "Roles and authority",
    summary: "Who owns decisions, instruction, observation, and handoffs."
  },
  {
    slug: "day",
    file: "day.md",
    title: "The rehearsal day",
    summary: "The day in sequence, with conditions, transitions, and Day 1 plans."
  },
  {
    slug: "library",
    file: "library.md",
    title: "Shared language",
    summary: "The terms, states, commands, and defaults used at runtime."
  },
  {
    slug: "install",
    file: "install.md",
    title: "Camp installation",
    summary: "What must be installed, in what order, and how ownership develops."
  },
  {
    slug: "heat",
    file: "heat.md",
    title: "Heat and safety",
    summary: "The operating policy, safety boundaries, and unresolved collisions."
  },
  {
    slug: "engineering-frame",
    file: "engineering-frame.md",
    title: "Engineering frame",
    summary: "Why the system uses states, interfaces, failure modes, and tests."
  },
  {
    slug: "field-prep",
    file: "field-prep.md",
    title: "Field preparation",
    summary: "The one-time dependency for preparing the physical rehearsal grid."
  },
  {
    slug: "band-camp-os",
    absolutePath: path.join(
      bandWebsiteRoot,
      "public",
      "resources",
      "band-camp",
      "BAND-CAMP-OS.md"
    ),
    title: "Band Camp OS",
    summary: "The earlier, higher-altitude view of the same operating system."
  }
];

const missing = documents
  .map((document) => document.absolutePath || path.join(sourceRoot, document.file))
  .filter((file) => !existsSync(file));

if (missing.length) {
  if (!existsSync(outputPath)) {
    console.error(`Regiment OS source is unavailable and no projection exists:\n${missing.join("\n")}`);
    process.exit(1);
  }
  console.log("Regiment OS source unavailable; preserving the checked-in projection.");
  process.exit(0);
}

const projection = {
  source: "BandsofAHS/projects/marching-band/regiment-os",
  documents: documents.map((document) => {
    const sourcePath = document.absolutePath || path.join(sourceRoot, document.file);
    return {
      slug: document.slug,
      title: document.title,
      summary: document.summary,
      sourceFile: document.file || "BAND-CAMP-OS.md",
      markdown: readFileSync(sourcePath, "utf8")
    };
  })
};

loadBandWebsiteEnv();
const secret = process.env.PORTAL_SESSION_SECRET;
if (!secret) {
  console.error("PORTAL_SESSION_SECRET is required to encrypt the Regiment OS projection.");
  process.exit(1);
}

const plaintext = JSON.stringify(projection);
const key = crypto.createHash("sha256").update(`regiment-os-content:${secret}`).digest();
const iv = crypto.createHash("sha256").update(plaintext).digest().subarray(0, 12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
const encrypted = {
  version: 1,
  iv: iv.toString("base64"),
  tag: cipher.getAuthTag().toString("base64"),
  data: ciphertext.toString("base64")
};
const serialized = `${JSON.stringify(encrypted, null, 2)}\n`;
if (checkOnly) {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== serialized) {
    console.error("Regiment OS web projection is out of date.");
    process.exit(1);
  }
  console.log("Regiment OS web projection is current.");
  process.exit(0);
}

writeFileSync(outputPath, serialized);
console.log(`Wrote ${projection.documents.length} Regiment OS documents.`);
