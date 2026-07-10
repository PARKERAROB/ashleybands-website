#!/usr/bin/env node
// Provenance lint — guards against new person-data columns landing in
// supabase/migrations/ with no traceable source.
//
// Rule: any CREATE TABLE or ALTER TABLE ... ADD COLUMN statement that
// introduces a person-data-looking column (name matches one of
// PERSON_DATA_PATTERNS) must be paired, in the SAME migration file, with
// either (a) a `source` (or `source_*`) column on that table, or (b) an
// explicit `-- provenance: ...` comment anywhere in the file explaining
// where the data comes from.
//
// BASELINE (2026-07-10): migrations 0001-0028 predate this lint (see
// ~/Atlas/BandsofAHS/projects/placement-authority-2026-27/provenance-lane-map.md
// §4 item 6) and are grandfathered — most already carry a `source` column,
// a few (families, staff, prospects, portal_access_requests, portal_update_requests,
// fee_payments, etc.) don't and were built before this convention existed.
// Retrofitting them is Phase 2 System-A→B consolidation work, not a lint fix.
// Raise BASELINE_MAX only when that consolidation lands; every migration
// numbered ABOVE it is held to the full rule below.
const BASELINE_MAX = 28;

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");

// Literal substrings from the build spec: email, phone, name, address, dob, medical.
const PERSON_DATA_PATTERNS = [/email/i, /phone/i, /name/i, /address/i, /dob/i, /medical/i];

const SOURCE_COL_RE = /^source(_.*)?$/i;

function isPersonDataColumn(colName) {
  return PERSON_DATA_PATTERNS.some((re) => re.test(colName));
}

// Pull "colname type ..." out of a comma-separated column-def block, ignoring
// nested parens (check (...) constraints, references(...) etc).
function splitColumnDefs(block) {
  const defs = [];
  let depth = 0;
  let current = "";
  for (const ch of block) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      defs.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) defs.push(current);
  return defs
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => !/^(primary key|unique|check|foreign key|constraint)\b/i.test(d));
}

function colNameFromDef(def) {
  const m = def.match(/^"?([a-zA-Z0-9_]+)"?\s+/);
  return m ? m[1] : null;
}

function lintFile(filePath, fileName) {
  const content = readFileSync(filePath, "utf8");
  const hasProvenanceComment = /--\s*provenance:/i.test(content);

  // table -> { columns: Set<string>, personDataHits: [{col, stmt}] }
  const tables = new Map();

  function getTable(name) {
    if (!tables.has(name)) tables.set(name, { columns: new Set(), personDataHits: [] });
    return tables.get(name);
  }

  // CREATE TABLE [if not exists] name ( ...columns... );
  const createRe = /create table\s+(?:if not exists\s+)?([a-zA-Z0-9_."]+)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = createRe.exec(content))) {
    const tableName = m[1].replace(/"/g, "");
    const t = getTable(tableName);
    for (const def of splitColumnDefs(m[2])) {
      const col = colNameFromDef(def);
      if (!col) continue;
      t.columns.add(col);
      if (isPersonDataColumn(col)) t.personDataHits.push({ col, stmt: "create table" });
    }
  }

  // ALTER TABLE name add column [if not exists] colname ...  (one or more,
  // comma-separated across lines, terminated by a lone `;`)
  const alterRe = /alter table\s+(?:if exists\s+)?([a-zA-Z0-9_."]+)\s+([\s\S]*?);/gi;
  while ((m = alterRe.exec(content))) {
    const tableName = m[1].replace(/"/g, "");
    const body = m[2];
    if (!/add column/i.test(body)) continue;
    const t = getTable(tableName);
    const addRe = /add column\s+(?:if not exists\s+)?"?([a-zA-Z0-9_]+)"?/gi;
    let am;
    while ((am = addRe.exec(body))) {
      const col = am[1];
      t.columns.add(col);
      if (isPersonDataColumn(col)) t.personDataHits.push({ col, stmt: "add column" });
    }
  }

  const failures = [];
  for (const [tableName, t] of tables) {
    if (t.personDataHits.length === 0) continue;
    const hasSourceCol = [...t.columns].some((c) => SOURCE_COL_RE.test(c));
    if (hasSourceCol || hasProvenanceComment) continue;
    for (const hit of t.personDataHits) {
      failures.push(
        `${fileName}: table "${tableName}" column "${hit.col}" (${hit.stmt}) looks like person data ` +
          `but the table has no "source"/"source_*" column and the file has no "-- provenance:" comment.`
      );
    }
  }
  return failures;
}

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let allFailures = [];
  for (const fileName of files) {
    const numMatch = fileName.match(/^(\d+)_/);
    const num = numMatch ? parseInt(numMatch[1], 10) : null;
    if (num !== null && num <= BASELINE_MAX) continue; // grandfathered
    const filePath = path.join(MIGRATIONS_DIR, fileName);
    allFailures = allFailures.concat(lintFile(filePath, fileName));
  }

  if (allFailures.length > 0) {
    console.error("Provenance lint FAILED:\n");
    for (const f of allFailures) console.error(`  - ${f}`);
    console.error(
      `\nFix: add a "source" (or "source_*") column to the table, or add a ` +
        `"-- provenance: <where this comes from>" comment in the migration file.`
    );
    process.exit(1);
  }

  console.log(
    `Provenance lint OK — ${files.length} migration file(s) scanned, ${BASELINE_MAX} grandfathered.`
  );
  process.exit(0);
}

main();
