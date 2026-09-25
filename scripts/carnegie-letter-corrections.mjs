#!/usr/bin/env node
// Atlas's command-line path for spelling, grammar and punctuation suggestions on Carnegie
// student letters (#108). It uses the server key the repository's admin scripts already use.
// It lists letters waiting for review and submits a suggestion marked as coming from Atlas.
// It never approves, edits the student's words, or changes a letter's status: staff decide.
//
//   node scripts/carnegie-letter-corrections.mjs list [--json]
//   node scripts/carnegie-letter-corrections.mjs suggest --letter <id> --version <n> --file <correction.json>
//     correction.json: { "meaning_text": "...", "help_text": "...", "note": "optional, what changed" }
//
// Letter text is private student writing. Keep the output on this machine; never paste it into a
// public issue, commit or log.

import { readFileSync } from "node:fs";
import { loadBandWebsiteEnv } from "./lib/workspace-paths.mjs";
import { validateCorrection } from "../lib/carnegieLetterCorrections.mjs";

loadBandWebsiteEnv();
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const ATLAS = "atlas";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path.split("?")[0]} failed (${response.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function list(asJson) {
  const letters = await rest("carnegie_student_letters?status=eq.needs_review&select=id,version,recipient_type,meaning_text,help_text,submitted_at&order=submitted_at.asc");
  const ids = letters.map((letter) => letter.id);
  const corrections = ids.length
    ? await rest(`carnegie_letter_corrections?letter_id=in.(${ids.join(",")})&select=letter_id,letter_version,source,status`)
    : [];
  const rows = letters.map((letter) => ({
    ...letter,
    open_suggestions: corrections.filter((c) => c.letter_id === letter.id && c.letter_version === letter.version && c.status === "suggested").length
  }));
  if (asJson) return console.log(JSON.stringify(rows, null, 2));
  if (!rows.length) return console.log("No letters are waiting for review.");
  for (const row of rows) {
    console.log(`\n=== ${row.id}  version ${row.version}  ${row.recipient_type}  open suggestions: ${row.open_suggestions}`);
    console.log(`[1] ${row.meaning_text}`);
    console.log(`[2] ${row.help_text}`);
  }
}

async function suggest() {
  const letterId = arg("letter");
  const version = Number(arg("version"));
  const file = arg("file");
  if (!letterId || !file || !Number.isInteger(version)) throw new Error("Usage: suggest --letter <id> --version <n> --file <correction.json>");
  const input = JSON.parse(readFileSync(file, "utf8"));
  const [letter] = await rest(`carnegie_student_letters?id=eq.${encodeURIComponent(letterId)}&select=id,version,status,meaning_text,help_text`);
  if (!letter) throw new Error("Letter not found.");
  const correction = validateCorrection(letter, { ...input, letter_version: version });
  const [saved] = await rest("carnegie_letter_corrections", {
    method: "POST",
    prefer: "return=representation",
    body: { letter_id: letter.id, ...correction, source: ATLAS, proposed_by: ATLAS }
  });
  await rest("audit_log", {
    method: "POST",
    body: { actor_type: "system", actor_id: ATLAS, actor_name: "Atlas", action: "letter.correction_suggested", table_name: "carnegie_letter_corrections", record_id: saved.id, changes: { letter_id: letter.id, letter_version: version }, route: "scripts/carnegie-letter-corrections.mjs" }
  });
  console.log(`Suggested correction ${saved.id} for letter ${letter.id} version ${version}. A staff reviewer decides.`);
}

try {
  if (!URL_BASE || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (.env.local).");
  const command = process.argv[2];
  if (command === "list") await list(process.argv.includes("--json"));
  else if (command === "suggest") await suggest();
  else throw new Error("Commands: list [--json] | suggest --letter <id> --version <n> --file <correction.json>");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
