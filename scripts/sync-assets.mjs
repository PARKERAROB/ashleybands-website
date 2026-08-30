#!/usr/bin/env node
/**
 * Import normalized current asset records from the BandsofAHS CSV homes.
 *
 * Check is the default. A check records an import run and its review issues but
 * does not change assets, extensions, secrets, or assignments.
 *
 *   npm run assets:sync
 *   npm run assets:sync -- --check
 *   npm run assets:sync -- --apply
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { bandsofAHSDataDir, loadBandWebsiteEnv } from "./lib/workspace-paths.mjs";

const SOURCE_FILES = [
  ["instrument-inventory.csv", "bandsofahs_instrument_inventory_csv"],
  ["lockers.csv", "bandsofahs_lockers_csv"],
  ["master-locks.csv", "bandsofahs_master_locks_csv"],
  ["tuners.csv", "bandsofahs_tuners_csv"],
];

const UNASSIGNED_VALUES = new Set(["", "none", "n/a", "na", "unknown", "unassigned", "not assigned", "available"]);

export function parseMode(argv = []) {
  const apply = argv.includes("--apply");
  const check = argv.includes("--check");
  if (apply && check) throw new Error("Choose either --check or --apply, not both.");
  return apply ? "apply" : "check";
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (character === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const nonempty = rows.filter((values) => values.some((value) => value !== ""));
  const [headers = [], ...dataRows] = nonempty;
  return dataRows.map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] || ""]),
  ));
}

export function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function hashSources(files) {
  const digest = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.name.localeCompare(right.name))) {
    digest.update(file.name);
    digest.update("\0");
    digest.update(file.contents);
    digest.update("\0");
  }
  return digest.digest("hex");
}

function text(value) {
  return String(value || "").trim();
}

function exactKey(value) {
  return text(value).normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function tagPart(value) {
  return text(value).normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
}

function nullableTimestamp(value) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nullableBoolean(value) {
  const normalized = exactKey(value);
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return null;
}

function sourceIdentity(sourceSystem, sourceKey) {
  return `${sourceSystem}\0${sourceKey}`;
}

function issue(sourceKey, issueType, summary, candidates = []) {
  return { sourceKey, issueType, summary, candidates };
}

function withoutKeys(row, keys) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !keys.has(key)));
}

function uniqueSourceRows(rows, sourceSystem, sourceKeyFor, issues) {
  const groups = new Map();
  for (const row of rows) {
    const sourceKey = text(sourceKeyFor(row));
    if (!sourceKey) {
      issues.push(issue("(missing)", "missing_source_key", "The source row has no stable asset identity and was not imported."));
      continue;
    }
    const grouped = groups.get(sourceKey) || [];
    grouped.push(row);
    groups.set(sourceKey, grouped);
  }
  const result = [];
  for (const [sourceKey, grouped] of groups) {
    if (grouped.length !== 1) {
      issues.push(issue(sourceKey, "duplicate_source_key", "More than one source row claims this asset identity; none were imported."));
      continue;
    }
    result.push({ sourceSystem, sourceKey, row: grouped[0] });
  }
  return result;
}

function normalizedHolders(values) {
  const byKey = new Map();
  for (const value of values) {
    const holder = text(value);
    const key = exactKey(holder);
    if (UNASSIGNED_VALUES.has(key)) continue;
    if (!byKey.has(key)) byKey.set(key, holder);
  }
  return [...byKey.values()];
}

function assetBase({ assetType, assetTag, displayName, operationalStatus, conditionSummary = "", location = "", sourceSystem, sourceKey, sourceRow, lastVerifiedAt = null, metadata = {} }) {
  return {
    asset_type: assetType,
    asset_tag: assetTag,
    display_name: displayName,
    lifecycle_status: "active",
    operational_status: operationalStatus || "unverified",
    condition_summary: conditionSummary,
    location,
    source_system: sourceSystem,
    source_key: sourceKey,
    source_hash: hashJson(sourceRow),
    last_verified_at: lastVerifiedAt,
    source_updated_at: lastVerifiedAt,
    metadata,
  };
}

export function buildImportPlan({ instrumentRows = [], lockerRows = [], lockRows = [], tunerRows = [] }) {
  const assets = [];
  const instrumentExtensions = [];
  const lockExtensions = [];
  const lockSecrets = [];
  const holderClaims = [];
  const issues = [];

  for (const { sourceSystem, sourceKey, row } of uniqueSourceRows(
    instrumentRows,
    "bandsofahs_instrument_inventory_csv",
    (item) => item.asset_id,
    issues,
  )) {
    const instrumentType = text(row.instrument_type);
    const brand = text(row.brand);
    const lastVerifiedAt = nullableTimestamp(row.last_verified_date);
    assets.push(assetBase({
      assetType: "instrument",
      assetTag: sourceKey,
      displayName: [brand, instrumentType, sourceKey].filter(Boolean).join(" · "),
      operationalStatus: text(row.play_status) || "unverified",
      conditionSummary: text(row.condition_rating),
      sourceSystem,
      sourceKey,
      sourceRow: row,
      lastVerifiedAt,
      metadata: {
        ownership_source: text(row.source),
        case_accessories: text(row.case_accessories),
      },
    }));
    instrumentExtensions.push({
      sourceSystem,
      sourceKey,
      values: {
        instrument_type: instrumentType,
        brand,
        model: text(row.model),
        model_markings: text(row.model_markings),
        serial_number: text(row.serial_number),
        serial_location: text(row.serial_location),
        finish: text(row.finish),
        key_pitch: text(row.key_pitch),
        level: text(row.level),
        play_status: text(row.play_status),
        repair_needed: text(row.repair_needed),
        repair_priority: text(row.repair_priority),
        visible_issues: text(row.visible_issues),
      },
    });
    const holders = normalizedHolders([row.assigned_student]);
    if (holders.length) holderClaims.push({ sourceSystem, sourceKey, holders });
  }

  for (const { sourceSystem, sourceKey, row } of uniqueSourceRows(
    lockerRows,
    "bandsofahs_lockers_csv",
    (item) => [text(item["Locker Prefix"]), text(item["Locker #"])].filter(Boolean).join(":"),
    issues,
  )) {
    const prefix = text(row["Locker Prefix"]);
    const number = text(row["Locker #"]);
    const holders = normalizedHolders([row["Student Assigned"], row["Student Assigned 2"]]);
    const safeSourceRow = withoutKeys(row, new Set(["Combination"]));
    assets.push(assetBase({
      assetType: "locker",
      assetTag: `LOCKER-${tagPart([prefix, number].filter(Boolean).join("-"))}`,
      displayName: `Locker ${[prefix, number].filter(Boolean).join(" ")}`,
      operationalStatus: holders.length ? "assigned" : "available",
      sourceSystem,
      sourceKey,
      sourceRow: safeSourceRow,
      metadata: { locker_prefix: prefix, locker_number: number },
    }));
    if (holders.length) holderClaims.push({ sourceSystem, sourceKey, holders });
  }

  for (const { sourceSystem, sourceKey, row } of uniqueSourceRows(
    lockRows,
    "bandsofahs_master_locks_csv",
    (item) => item.serial,
    issues,
  )) {
    const combination = text(row.combination);
    const safeSourceRow = withoutKeys(row, new Set(["combination"]));
    assets.push(assetBase({
      assetType: "lock",
      assetTag: `LOCK-${tagPart(sourceKey)}`,
      displayName: `Master lock ${sourceKey}`,
      operationalStatus: "unverified",
      sourceSystem,
      sourceKey,
      sourceRow: safeSourceRow,
      metadata: {},
    }));
    lockExtensions.push({
      sourceSystem,
      sourceKey,
      values: {
        serial_number: sourceKey,
        master_key: text(row.master_key),
        confidence: text(row.confidence),
        inventoried: nullableBoolean(row.inventoried),
        notes: text(row.notes),
      },
    });
    if (combination) {
      lockSecrets.push({ sourceSystem, sourceKey, combination });
    } else {
      issues.push(issue(sourceKey, "missing_lock_combination", "The lock has no source combination; no secret row will be created."));
    }
    const holders = normalizedHolders([row.assigned_student]);
    if (holders.length) holderClaims.push({ sourceSystem, sourceKey, holders });
  }

  for (const { sourceSystem, sourceKey, row } of uniqueSourceRows(
    tunerRows,
    "bandsofahs_tuners_csv",
    (item) => item.tuner_number,
    issues,
  )) {
    const holders = normalizedHolders([row.student_assigned, row.student_assigned_2]);
    const assignmentStatus = exactKey(row.assignment_status);
    assets.push(assetBase({
      assetType: "tuner",
      assetTag: `TUNER-${tagPart(sourceKey)}`,
      displayName: `Tuner ${sourceKey}`,
      operationalStatus: text(row.physical_status) || text(row.assignment_status) || "unverified",
      sourceSystem,
      sourceKey,
      sourceRow: row,
      metadata: { physical_status: text(row.physical_status), notes: text(row.notes) },
    }));
    if (holders.length && assignmentStatus === "assigned") {
      holderClaims.push({ sourceSystem, sourceKey, holders });
    } else if (holders.length) {
      issues.push(issue(sourceKey, "holder_status_mismatch", "The tuner names a holder but is not marked assigned; no assignment was created."));
    }
  }

  return {
    assets,
    instrumentExtensions,
    lockExtensions,
    lockSecrets,
    holderClaims,
    issues,
    sourceRows: instrumentRows.length + lockerRows.length + lockRows.length + tunerRows.length,
  };
}

export function buildActiveStudentIndex(students) {
  const byKey = new Map();
  for (const student of students || []) {
    if (exactKey(student.status) !== "active") continue;
    const names = [
      student.source_student_id,
      student.display_name,
      [student.legal_first, student.legal_last].filter(Boolean).join(" "),
      [student.preferred_first, student.legal_last].filter(Boolean).join(" "),
      [student.legal_last, student.legal_first].filter(Boolean).join(", "),
      [student.legal_last, student.preferred_first].filter(Boolean).join(", "),
    ];
    for (const name of names) {
      const key = exactKey(name);
      if (!key) continue;
      const ids = byKey.get(key) || new Set();
      ids.add(student.id);
      byKey.set(key, ids);
    }
  }
  return byKey;
}

export function resolveHolderClaims(holderClaims, students) {
  const studentIndex = buildActiveStudentIndex(students);
  const assignments = [];
  const issues = [];
  for (const claim of holderClaims) {
    const holders = normalizedHolders(claim.holders);
    if (holders.length !== 1) {
      issues.push(issue(claim.sourceKey, "multiple_source_holders", "The source names multiple current holders but the asset supports one open assignment; no assignment was created."));
      continue;
    }
    const candidateIds = [...(studentIndex.get(exactKey(holders[0])) || [])].sort();
    if (candidateIds.length === 0) {
      issues.push(issue(claim.sourceKey, "unmatched_student", "No active portal student exactly matches the source holder; no assignment was created."));
      continue;
    }
    if (candidateIds.length > 1) {
      issues.push(issue(
        claim.sourceKey,
        "ambiguous_student",
        "More than one active portal student exactly matches the source holder; no assignment was created.",
        candidateIds.map((studentId) => ({ student_id: studentId })),
      ));
      continue;
    }
    assignments.push({
      sourceSystem: claim.sourceSystem,
      sourceKey: claim.sourceKey,
      studentId: candidateIds[0],
    });
  }
  return { assignments, issues };
}

export function planOpenAssignments(resolvedAssignments, assetIdsByIdentity, existingAssignments = []) {
  const existingByAsset = new Map(existingAssignments.map((assignment) => [assignment.asset_id, assignment]));
  const inserts = [];
  const issues = [];
  let existing = 0;

  for (const assignment of resolvedAssignments) {
    const assetId = assetIdsByIdentity.get(sourceIdentity(assignment.sourceSystem, assignment.sourceKey));
    if (!assetId) continue;
    const current = existingByAsset.get(assetId);
    if (!current) {
      inserts.push({
        asset_id: assetId,
        student_id: assignment.studentId,
        program_group_id: null,
        holder_label: "",
        starts_at: null,
        ends_at: null,
        assignment_status: "provisional",
        source_system: assignment.sourceSystem,
        source_ref: assignment.sourceKey,
        notes: "",
      });
      continue;
    }
    if (current.student_id === assignment.studentId) {
      existing += 1;
      continue;
    }
    issues.push(issue(
      assignment.sourceKey,
      "current_assignment_conflict",
      "The asset already has a different open assignment; neither assignment was changed.",
      [current.student_id, assignment.studentId].filter(Boolean).map((studentId) => ({ student_id: studentId })),
    ));
  }
  return { inserts, issues, existing };
}

export function buildTransactionalApplyPayload({ runId, plan, resolvedAssignments, issues }) {
  return {
    p_run_id: runId,
    p_assets: plan.assets,
    p_instruments: plan.instrumentExtensions.map((extension) => ({
      source_system: extension.sourceSystem,
      source_key: extension.sourceKey,
      ...extension.values,
    })),
    p_locks: plan.lockExtensions.map((extension) => ({
      source_system: extension.sourceSystem,
      source_key: extension.sourceKey,
      ...extension.values,
    })),
    p_lock_secrets: plan.lockSecrets.map((secret) => ({
      source_system: secret.sourceSystem,
      source_key: secret.sourceKey,
      combination: secret.combination,
    })),
    p_assignments: resolvedAssignments.map((assignment) => ({
      source_system: assignment.sourceSystem,
      source_key: assignment.sourceKey,
      student_id: assignment.studentId,
    })),
    p_issues: issues,
  };
}

function readSources(dataDirectory) {
  return SOURCE_FILES.map(([name, sourceSystem]) => {
    const contents = readFileSync(path.join(dataDirectory, name), "utf8");
    return { name, sourceSystem, contents, rows: parseCsv(contents) };
  });
}

function throwIfError(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data || [];
}

async function insertInChunks(supabase, table, rows) {
  for (let offset = 0; offset < rows.length; offset += 250) {
    const result = await supabase.from(table).insert(rows.slice(offset, offset + 250));
    throwIfError(result, `${table} insert failed`);
  }
}

async function loadExistingAssets(supabase) {
  const result = await supabase
    .from("assets")
    .select("id,source_system,source_key,source_hash")
    .in("source_system", SOURCE_FILES.map(([, sourceSystem]) => sourceSystem));
  return throwIfError(result, "Could not load existing assets");
}

async function loadOpenAssignments(supabase, assetIds) {
  if (!assetIds.length) return [];
  const rows = [];
  for (let offset = 0; offset < assetIds.length; offset += 250) {
    const result = await supabase
      .from("asset_assignments")
      .select("id,asset_id,student_id,program_group_id,holder_label,assignment_status")
      .in("asset_id", assetIds.slice(offset, offset + 250))
      .is("ends_at", null)
      .in("assignment_status", ["current", "provisional"]);
    rows.push(...throwIfError(result, "Could not load open asset assignments"));
  }
  return rows;
}

async function createRun(supabase, mode, sourceHash, sourceRows) {
  const result = await supabase.from("asset_import_runs").insert({
    source_system: "bandsofahs_asset_csvs",
    source_hash: sourceHash,
    mode,
    status: "running",
    source_rows: sourceRows,
  }).select("id").single();
  const rows = throwIfError(result, "Could not create asset import run");
  return rows.id;
}

async function finishRun(supabase, runId, status, fields) {
  const result = await supabase.from("asset_import_runs").update({
    status,
    completed_at: new Date().toISOString(),
    ...fields,
  }).eq("id", runId);
  throwIfError(result, "Could not finish asset import run");
}

async function recordIssues(supabase, runId, issues) {
  if (!issues.length) return;
  await insertInChunks(supabase, "asset_import_issues", issues.map((item) => ({
    import_run_id: runId,
    source_key: item.sourceKey,
    issue_type: item.issueType,
    summary: item.summary,
    candidates: item.candidates,
  })));
}

export async function runAssetImport({ supabase, dataDirectory = bandsofAHSDataDir, mode = "check" }) {
  const sources = readSources(dataDirectory);
  const sourceHash = hashSources(sources);
  const byName = new Map(sources.map((source) => [source.name, source.rows]));
  const plan = buildImportPlan({
    instrumentRows: byName.get("instrument-inventory.csv"),
    lockerRows: byName.get("lockers.csv"),
    lockRows: byName.get("master-locks.csv"),
    tunerRows: byName.get("tuners.csv"),
  });
  const runId = await createRun(supabase, mode, sourceHash, plan.sourceRows);

  try {
    const studentResult = await supabase
      .from("portal_students")
      .select("id,source_student_id,legal_first,legal_last,preferred_first,display_name,status")
      .eq("status", "active");
    const students = throwIfError(studentResult, "Could not load active portal students");
    const resolved = resolveHolderClaims(plan.holderClaims, students);
    const issues = [...plan.issues, ...resolved.issues];

    if (mode === "apply") {
      const transactionResult = await supabase.rpc(
        "apply_asset_import_transaction",
        buildTransactionalApplyPayload({
          runId,
          plan,
          resolvedAssignments: resolved.assignments,
          issues,
        }),
      );
      const applied = throwIfError(transactionResult, "Transactional asset apply failed");
      if (!applied?.summary) throw new Error("Transactional asset apply returned no summary");
      return { runId, mode, sourceHash, summary: applied.summary };
    }

    const existingBefore = await loadExistingAssets(supabase);
    const importedByIdentity = new Map(existingBefore.map((asset) => [
      sourceIdentity(asset.source_system, asset.source_key),
      asset,
    ]));
    const assetIdsByIdentity = new Map(plan.assets.map((asset) => {
      const identity = sourceIdentity(asset.source_system, asset.source_key);
      const imported = importedByIdentity.get(identity);
      // A check needs a placeholder identity so it can accurately report the
      // assignment that would follow a new asset. Placeholders are never sent
      // to Supabase and are excluded from the existing-assignment query.
      return [identity, imported?.id || `check:${hashJson(identity)}`];
    }));

    const realAssetIds = [...assetIdsByIdentity.values()].filter((assetId) => !assetId.startsWith("check:"));
    const openAssignments = await loadOpenAssignments(supabase, realAssetIds);
    const assignmentPlan = planOpenAssignments(resolved.assignments, assetIdsByIdentity, openAssignments);
    issues.push(...assignmentPlan.issues);

    await recordIssues(supabase, runId, issues);
    const existingByIdentity = new Map(existingBefore.map((asset) => [
      sourceIdentity(asset.source_system, asset.source_key),
      asset,
    ]));
    const upToDate = plan.assets.filter((asset) => {
      const existing = existingByIdentity.get(sourceIdentity(asset.source_system, asset.source_key));
      return existing?.source_hash === asset.source_hash;
    }).length;
    const summary = {
      desired_assets: plan.assets.length,
      assets_up_to_date_before_run: upToDate,
      assets_to_upsert: plan.assets.length - upToDate,
      assignments_to_create: assignmentPlan.inserts.length,
      assignments_already_open: assignmentPlan.existing,
      issues: issues.length,
      history_inferred: false,
    };
    await finishRun(supabase, runId, "complete", {
      matched_rows: upToDate,
      issue_rows: issues.length,
      summary,
    });
    return { runId, mode, sourceHash, summary };
  } catch (error) {
    try {
      await finishRun(supabase, runId, "failed", {
        summary: { error: String(error?.message || error).slice(0, 500) },
      });
    } catch {
      // Preserve the original import error if the failure marker cannot be written.
    }
    throw error;
  }
}

async function main() {
  let mode;
  try {
    mode = parseMode(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  loadBandWebsiteEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY in .env.local.");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });
  try {
    const result = await runAssetImport({ supabase, mode });
    console.log(`Asset import ${result.mode.toUpperCase()} complete.`);
    console.log(`desired_assets=${result.summary.desired_assets}`);
    console.log(`assets_up_to_date_before_run=${result.summary.assets_up_to_date_before_run}`);
    console.log(`assignments_to_create=${result.summary.assignments_to_create}`);
    console.log(`issues=${result.summary.issues}`);
    if (mode === "check") console.log("No assets, extensions, secrets, or assignments were changed.");
  } catch (error) {
    console.error(`Asset import failed: ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) await main();
