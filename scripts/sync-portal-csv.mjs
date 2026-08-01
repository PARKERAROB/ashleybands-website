#!/usr/bin/env node
/**
 * Mirror BandsofAHS canonical CSV records into the Family Portal Supabase tables.
 *
 * Dry-run by default:
 *   node scripts/sync-portal-csv.mjs
 *
 * Apply writes after migration 0006 is installed:
 *   node scripts/sync-portal-csv.mjs --apply
 *
 * Report current mirror counts:
 *   node scripts/sync-portal-csv.mjs --report
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bandsofAHSDataDir, loadBandWebsiteEnv } from "./lib/workspace-paths.mjs";

const BAND_DATA_DIR = bandsofAHSDataDir;
const APPLY = process.argv.includes("--apply");
const REPORT = process.argv.includes("--report");
const CHECK = process.argv.includes("--check");
const SUMMARY = process.argv.includes("--summary");

loadBandWebsiteEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

if ((APPLY || REPORT || CHECK) && (!supabaseUrl || !supabaseSecret)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}

const supabase = supabaseUrl && supabaseSecret
  ? createClient(supabaseUrl, supabaseSecret, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

if (REPORT && !CHECK && !APPLY) {
  const reportOk = await printReport();
  if (!reportOk && !APPLY) process.exit(1);
  if (!APPLY) process.exit(0);
}

const students = readCsv("students.csv");
const parents = readCsv("parents.csv");
const studentBySourceId = new Map(students.map((row) => [row.id, row]));
const guardianPeople = new Map();
const studentPeople = new Map();
const relationships = [];
const contactMethods = [];
const conflicts = [];

const portalStudents = students.map((row) => {
  const displayName = [row.preferred_first || row.legal_first, row.legal_last].filter(Boolean).join(" ").trim();
  const sourceRowHash = hashJson(row);
  const sourcePersonKey = `student:${row.id}`;
  studentPeople.set(sourcePersonKey, {
    source_person_key: sourcePersonKey,
    person_type: "student",
    display_name: displayName || row.id,
    first_name: row.preferred_first || row.legal_first || null,
    last_name: row.legal_last || null,
    source: "bdos_students_csv",
    source_row_hash: sourceRowHash
  });
  relationships.push({
    sourceStudentId: row.id,
    sourcePersonKey,
    role: "student",
    primary_contact: false,
    source: "bdos_students_csv",
    source_row_hash: sourceRowHash
  });
  if (row.school_email) {
    contactMethods.push({
      sourcePersonKey,
      contact_type: "email",
      value_display: row.school_email,
      value_normalized: normalizeEmail(row.school_email),
      source: "bdos_students_csv",
      source_row_hash: sourceRowHash,
      evidence: {
        source_file: "data/students.csv",
        source_student_id: row.id
      }
    });
  }
  if (row.cell_phone) {
    contactMethods.push({
      sourcePersonKey,
      contact_type: "phone",
      value_display: row.cell_phone,
      value_normalized: normalizePhone(row.cell_phone),
      source: "bdos_students_csv",
      source_row_hash: sourceRowHash,
      evidence: {
        source_file: "data/students.csv",
        source_student_id: row.id
      }
    });
  }
  return {
    source_student_id: row.id,
    legal_first: row.legal_first || null,
    legal_last: row.legal_last || null,
    preferred_first: row.preferred_first || null,
    display_name: displayName || row.id,
    grade_fall26: row.grade_fall26 || null,
    // Program role, mirrored like grade_fall26 (NOT a contact value, so the guard below
    // does not apply). Uniform sizing needs it to pick the guard vs band Synced Up chart
    // -- see lib/uniformSizing.js and migration 0032.
    mb_role_2026: row.mb_role_2026 || null,
    // COMPLIANCE GUARD (2026-07-10): contact values are family-owned, never mirrored from the
    // IC-derived CSV. Kept null here so a re-sync can't repopulate what Phase 1.1 deleted.
    school_email: null,
    cell_phone: null,
    status: row.status || null,
    notes: row.notes || null,
    source: "bdos_students_csv",
    source_row_hash: sourceRowHash
  };
});

for (const row of parents) {
  const sourceStudent = studentBySourceId.get(row.student_id);
  if (!sourceStudent) {
    conflicts.push({
      type: "parent_missing_student",
      student_id: row.student_id,
      parent_name: row.parent_name,
      parent_email: row.parent_email
    });
    continue;
  }
  if (!row.parent_name && !row.parent_email && !row.parent_phone) continue;

  const email = normalizeEmail(row.parent_email);
  const phone = normalizePhone(row.parent_phone);
  const sourcePersonKey = guardianKey(row, email, phone);
  const sourceRowHash = hashJson(row);
  const displayName = row.parent_name || row.parent_email || row.parent_phone || sourcePersonKey;
  const existing = guardianPeople.get(sourcePersonKey);

  guardianPeople.set(sourcePersonKey, {
    source_person_key: sourcePersonKey,
    person_type: "guardian",
    display_name: existing?.display_name || displayName,
    first_name: existing?.first_name || splitName(displayName).first,
    last_name: existing?.last_name || splitName(displayName).last,
    source: "bdos_parents_csv",
    source_row_hash: sourceRowHash
  });

  relationships.push({
    sourceStudentId: row.student_id,
    sourcePersonKey,
    role: row.role || null,
    primary_contact: truthy(row.primary),
    source: "bdos_parents_csv",
    source_row_hash: sourceRowHash
  });

  if (email) {
    contactMethods.push({
      sourcePersonKey,
      contact_type: "email",
      value_display: row.parent_email,
      value_normalized: email,
      source: "bdos_parents_csv",
      source_row_hash: sourceRowHash,
      evidence: {
        source_file: "data/parents.csv",
        source_student_id: row.student_id
      }
    });
  }
  if (phone) {
    contactMethods.push({
      sourcePersonKey,
      contact_type: "phone",
      value_display: row.parent_phone,
      value_normalized: phone,
      source: "bdos_parents_csv",
      source_row_hash: sourceRowHash,
      evidence: {
        source_file: "data/parents.csv",
        source_student_id: row.student_id
      }
    });
  }
}

const portalPeople = [...studentPeople.values(), ...guardianPeople.values()];
const dedupedRelationships = dedupeRelationships(relationships);
const dedupedContactMethods = dedupeContactMethods(contactMethods);

console.log(`Family Portal CSV sync ${APPLY ? "APPLY" : "DRY RUN"}`);
console.log(`students=${portalStudents.length}`);
console.log(`people=${portalPeople.length} guardians=${guardianPeople.size} student_people=${studentPeople.size}`);
console.log(`relationships=${dedupedRelationships.length}`);
console.log(`contact_methods=${dedupedContactMethods.length}`);
console.log(`conflicts=${conflicts.length}`);

if (conflicts.length && !SUMMARY) {
  console.log("\nConflicts:");
  for (const conflict of conflicts.slice(0, 20)) console.log(JSON.stringify(conflict));
  if (conflicts.length > 20) console.log(`... ${conflicts.length - 20} more`);
}

if (CHECK) {
  const mirrorCurrent = await checkMirror();
  if (!APPLY) process.exit(mirrorCurrent ? 0 : 1);
}

if (!APPLY) {
  console.log("\nNo writes made. Re-run with --apply after migration 0006 is installed.");
  process.exit(0);
}

async function checkMirror() {
  const [{ data: dbStudents, error: studentError }, { data: dbPeople, error: peopleError }] =
    await Promise.all([
      supabase.from("portal_students").select("source_student_id,source_row_hash"),
      supabase.from("portal_people").select("source_person_key,source_row_hash")
    ]);
  if (studentError) throw studentError;
  if (peopleError) throw peopleError;

  const compare = (expectedRows, actualRows, key) => {
    const expected = new Map(expectedRows.map((row) => [row[key], row.source_row_hash]));
    const actual = new Map((actualRows || []).map((row) => [row[key], row.source_row_hash]));
    let missing = 0;
    let changed = 0;
    for (const [id, hash] of expected) {
      if (!actual.has(id)) missing += 1;
      else if (actual.get(id) !== hash) changed += 1;
    }
    let extra = 0;
    for (const id of actual.keys()) if (!expected.has(id)) extra += 1;
    return { expected: expected.size, actual: actual.size, missing, changed, extra };
  };

  const studentsResult = compare(portalStudents, dbStudents, "source_student_id");
  const peopleResult = compare(portalPeople, dbPeople, "source_person_key");
  const current =
    studentsResult.missing === 0 &&
    studentsResult.changed === 0 &&
    peopleResult.missing === 0 &&
    peopleResult.changed === 0 &&
    conflicts.length === 0;

  console.log("Portal mirror drift check (read-only):");
  console.log(
    `students expected=${studentsResult.expected} hosted=${studentsResult.actual} ` +
      `missing=${studentsResult.missing} changed=${studentsResult.changed} extra=${studentsResult.extra}`
  );
  console.log(
    `people expected=${peopleResult.expected} hosted=${peopleResult.actual} ` +
      `missing=${peopleResult.missing} changed=${peopleResult.changed} extra=${peopleResult.extra}`
  );
  console.log(`local conflicts=${conflicts.length}`);
  console.log(current ? "Portal mirror OK" : "Portal mirror DRIFTED (no writes made)");
  return current;
}

await applySync();

async function applySync() {
  const run = await insertSyncRun();
  try {
    const syncId = run.id;
    const studentRows = portalStudents.map((row) => ({ ...row, last_seen_sync_id: syncId }));
    await upsert("portal_students", studentRows, "source_student_id");

    const personRows = portalPeople.map((row) => ({ ...row, last_seen_sync_id: syncId }));
    await upsert("portal_people", personRows, "source_person_key");

    const [{ data: dbStudents }, { data: dbPeople }] = await Promise.all([
      supabase.from("portal_students").select("id, source_student_id"),
      supabase.from("portal_people").select("id, source_person_key")
    ]);
    const studentIds = new Map((dbStudents || []).map((row) => [row.source_student_id, row.id]));
    const personIds = new Map((dbPeople || []).map((row) => [row.source_person_key, row.id]));

    const relationshipRows = dedupedRelationships
      .map((row) => ({
        student_id: studentIds.get(row.sourceStudentId),
        person_id: personIds.get(row.sourcePersonKey),
        role: row.role,
        relationship_status: "trusted",
        primary_contact: row.primary_contact,
        source: row.source,
        source_row_hash: row.source_row_hash,
        last_seen_sync_id: syncId
      }))
      .filter((row) => row.student_id && row.person_id);
    await upsert("portal_student_people", relationshipRows, "student_id,person_id");

    const contactRows = dedupedContactMethods
      .map((row) => ({
        person_id: personIds.get(row.sourcePersonKey),
        contact_type: row.contact_type,
        value_display: row.value_display,
        value_normalized: row.value_normalized,
        verification_status: "unverified",
        evidence: row.evidence,
        source: row.source,
        source_row_hash: row.source_row_hash,
        last_seen_sync_id: syncId
      }))
      .filter((row) => row.person_id && row.value_normalized);
    // COMPLIANCE GUARD (2026-07-10): contact methods (emails/phones) are now FAMILY-OWNED —
    // provided by families through the portal with consent, never pushed from the IC-derived CSV.
    // The IC-sourced contact rows were deleted from prod on 2026-07-10 (Phase 1.1, delete-and-
    // re-enter). Do NOT re-mirror contact methods here. Person/student/relationship structure still
    // syncs from the roster; contact VALUES do not. See BandsofAHS/projects/placement-authority-2026-27.
    const SYNC_CONTACT_METHODS = false;
    if (SYNC_CONTACT_METHODS) {
      await upsert("portal_contact_methods", contactRows, "person_id,contact_type,value_normalized");
    } else {
      console.log(`contact_methods: SKIPPED ${contactRows.length} rows (family-owned since 2026-07-10; see compliance guard)`);
    }

    await finishSyncRun(syncId, "completed", {
      students_seen: portalStudents.length,
      people_seen: portalPeople.length,
      relationships_seen: relationshipRows.length,
      contact_methods_seen: contactRows.length,
      conflicts,
      notes: "CSV mirror sync completed from BandsofAHS students.csv and parents.csv."
    });
    console.log("\nSync applied.");
    await printReport();
  } catch (error) {
    await finishSyncRun(run.id, "failed", {
      conflicts,
      notes: error.message
    }).catch(() => {});
    throw error;
  }
}

async function insertSyncRun() {
  const { data, error } = await supabase
    .from("portal_sync_runs")
    .insert({ source: "bdos_csv", status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function finishSyncRun(id, status, fields) {
  const { error } = await supabase
    .from("portal_sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      ...fields
    })
    .eq("id", id);
  if (error) throw error;
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  console.log(`upserted ${rows.length} ${table}`);
}

async function printReport() {
  const { data, error } = await supabase
    .from("portal_mirror_counts")
    .select("entity,row_count")
    .order("entity");
  if (error) {
    console.error(`Report failed: ${error.message}`);
    return false;
  }
  console.log("Portal mirror counts:");
  for (const row of data || []) console.log(`${row.entity}: ${row.row_count}`);
  return true;
}

function readCsv(name) {
  const text = readFileSync(join(BAND_DATA_DIR, name), "utf8");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === "\"" && next === "\"") {
        field += "\"";
        i++;
      } else if (ch === "\"") {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...dataRows] = rows.filter((values) => values.some((value) => value !== ""));
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((key, i) => [key, values[i] || ""]))
  );
}

function guardianKey(row, email, phone) {
  if (email) return `guardian-email:${email}`;
  if (phone) return `guardian-phone:${phone}`;
  return `guardian-student-name:${row.student_id}:${normalizeText(row.parent_name)}`;
}

function dedupeContactMethods(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.sourcePersonKey}|${row.contact_type}|${row.value_normalized}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

function dedupeRelationships(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.sourceStudentId}|${row.sourcePersonKey}`;
    if (!seen.has(key)) {
      seen.set(key, row);
      continue;
    }
    const existing = seen.get(key);
    seen.set(key, {
      ...existing,
      role: existing.role || row.role,
      primary_contact: existing.primary_contact || row.primary_contact,
      source_row_hash: hashJson([existing.source_row_hash, row.source_row_hash])
    });
  }
  return [...seen.values()];
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function truthy(value) {
  return ["1", "true", "yes", "y", "primary"].includes(normalizeText(value));
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || null, last: null };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) };
}
