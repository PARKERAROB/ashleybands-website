import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAudit, staffActor } from "@/lib/auditLog";

const CATEGORY = {
  instrument: { id: "instruments", label: "Instruments", connected: true, dedicatedHref: "/admin/instrument-inventory" },
  locker: { id: "lockers", label: "Lockers", connected: true, dedicatedHref: "" },
  lock: { id: "locks", label: "Locks", connected: true, dedicatedHref: "" },
  tuner: { id: "tuners", label: "Tuners", connected: true, dedicatedHref: "" },
  music: { id: "music", label: "Music", connected: false, dedicatedHref: "/admin/music-library" },
  uniform: { id: "uniforms", label: "Uniforms", connected: false, dedicatedHref: "/admin/measurements" },
};

function privateJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function stateFor(asset, assignment) {
  const status = String(asset.operational_status || "").toLowerCase();
  if (["missing","repair","needs_repair","not_playable","unverified"].some((value) => status.includes(value))) return "attention";
  if (assignment) return "assigned";
  return "available";
}

function title(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ASSETS_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  try {
    const url = new URL(request.url);
    const studentId = url.searchParams.get("student") || "";
    const assetId = url.searchParams.get("asset") || "";
    const requestedCategory = url.searchParams.get("category") || "";
    const requestedStatus = url.searchParams.get("status") || "";
    let assetQuery = supabaseAdmin.from("assets")
      .select("id,asset_type,asset_tag,display_name,lifecycle_status,operational_status,condition_summary,location,source_system,source_key,last_verified_at,source_updated_at,updated_at,metadata,asset_instruments(instrument_type,brand,model,model_markings,serial_number,serial_location,finish,key_pitch,level,play_status,repair_needed,repair_priority,visible_issues),asset_locks(serial_number,confidence,inventoried),asset_lockers(locker_prefix,locker_number,bank_label,notes),asset_tuners(tuner_number,model,physical_status,notes),asset_music(title,composer,arranger,publisher,catalog_number,grade_level,copy_count,notes),asset_uniforms(uniform_type,piece_number,size_label,style_label,notes)")
      .order("asset_type", { ascending: true })
      .order("display_name", { ascending: true })
      .limit(2000);
    assetQuery = assetId
      ? assetQuery.eq("id", assetId)
      : assetQuery.eq("lifecycle_status", "active");
    const [{ data: assets, error: assetError }, { data: assignments, error: assignmentError }, { data: requestedStudent, error: studentError }] = await Promise.all([
      assetQuery,
      supabaseAdmin.from("asset_assignments")
        .select("id,asset_id,student_id,holder_label,starts_at,ends_at,assignment_status,source_system,source_ref,updated_at,portal_students(id,display_name,status)")
        .is("ends_at", null)
        .in("assignment_status", ["current", "provisional"]),
      studentId ? supabaseAdmin.from("portal_students")
        .select("id,display_name,status")
        .eq("id", studentId)
        .eq("status", "active")
        .maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (assetError || assignmentError || studentError) throw new Error("asset-read");

    const assignmentByAsset = new Map((assignments || []).map((assignment) => [assignment.asset_id, assignment]));
    const allRecords = (assets || []).map((asset) => {
      const assignment = assignmentByAsset.get(asset.id) || null;
      const holderRow = Array.isArray(assignment?.portal_students) ? assignment.portal_students[0] : assignment?.portal_students;
      const instrument = Array.isArray(asset.asset_instruments) ? asset.asset_instruments[0] : asset.asset_instruments;
      const lock = Array.isArray(asset.asset_locks) ? asset.asset_locks[0] : asset.asset_locks;
      const locker = Array.isArray(asset.asset_lockers) ? asset.asset_lockers[0] : asset.asset_lockers;
      const tuner = Array.isArray(asset.asset_tuners) ? asset.asset_tuners[0] : asset.asset_tuners;
      const music = Array.isArray(asset.asset_music) ? asset.asset_music[0] : asset.asset_music;
      const uniform = Array.isArray(asset.asset_uniforms) ? asset.asset_uniforms[0] : asset.asset_uniforms;
      const category = CATEGORY[asset.asset_type] || { id: asset.asset_type, label: title(asset.asset_type), connected: true, dedicatedHref: "" };
      const details = [];
      if (instrument) {
        details.push(["Brand", instrument.brand || "Not recorded"], ["Model", instrument.model || instrument.model_markings || "Not recorded"], ["Serial", instrument.serial_number || "Not recorded"], ["Play status", title(instrument.play_status) || "Not recorded"]);
        if (instrument.repair_needed) details.push(["Repair", instrument.repair_needed]);
      }
      if (lock) details.push(["Serial", lock.serial_number || "Not recorded"], ["Inventoried", lock.inventoried == null ? "Not recorded" : lock.inventoried ? "Yes" : "No"]);
      if (tuner) details.push(["Tuner number", tuner.tuner_number || asset.asset_tag || "Not recorded"], ["Physical status", tuner.physical_status || "Not recorded"]);
      if (locker) details.push(["Locker", [locker.locker_prefix, locker.locker_number].filter(Boolean).join(" ") || asset.asset_tag || "Not recorded"]);
      if (music) details.push(["Composer", music.composer || "Not recorded"], ["Catalog", music.catalog_number || "Not recorded"]);
      if (uniform) details.push(["Uniform type", uniform.uniform_type || "Not recorded"], ["Size", uniform.size_label || "Not recorded"]);
      const state = stateFor(asset, assignment);
      return {
        id: asset.id,
        assetType: category.id,
        tag: asset.asset_tag,
        name: asset.display_name,
        type: instrument?.instrument_type ? title(instrument.instrument_type) : category.label.replace(/s$/, ""),
        status: state === "assigned" ? (assignment.assignment_status === "provisional" ? "Provisional assignment" : "Assigned") : state === "attention" ? title(asset.operational_status) : "Available",
        state,
        condition: asset.condition_summary || "Not recorded",
        location: asset.location || "Not recorded",
        holder: assignment ? {
          id: holderRow?.id || assignment.student_id || "",
          name: holderRow?.display_name || assignment.holder_label || "Unmatched holder",
          status: holderRow?.status || (assignment.student_id ? "unknown" : "unmatched"),
        } : null,
        assignment: assignment ? {
          id: assignment.id,
          startsAt: assignment.starts_at,
          status: assignment.assignment_status,
          source: assignment.source_system,
        } : null,
        source: asset.source_system,
        sourceKey: asset.source_key,
        sourceUpdatedAt: asset.last_verified_at || asset.source_updated_at || asset.updated_at,
        sourceDateLabel: asset.last_verified_at ? "Last verified" : asset.source_updated_at ? "Source update" : "Imported",
        details,
        dedicatedHref: category.dedicatedHref,
      };
    });
    const records = allRecords.filter((record) => {
      if (studentId && record.holder?.id !== studentId) return false;
      if (requestedCategory && requestedCategory !== "all" && record.assetType !== requestedCategory) return false;
      if (requestedStatus && requestedStatus !== "all" && record.state !== requestedStatus) return false;
      return true;
    });

    const categories = Object.values(CATEGORY).map((category) => ({
      ...category,
      count: category.connected ? allRecords.filter((record) => record.assetType === category.id).length : null,
      status: category.connected ? "connected" : "not_connected",
    }));
    const students = [...new Map([
      ...allRecords.filter((record) => record.holder?.id && record.holder.status === "active").map((record) => [record.holder.id, record.holder]),
      ...(requestedStudent ? [[requestedStudent.id, { id: requestedStudent.id, name: requestedStudent.display_name, status: requestedStudent.status }]] : []),
    ]).values()]
      .sort((left, right) => left.name.localeCompare(right.name));
    const summary = records.reduce((result, record) => {
      result.total += 1;
      result[record.state] += 1;
      return result;
    }, { total: 0, assigned: 0, available: 0, attention: 0 });
    const sourceFreshness = [...records.reduce((result, record) => {
      const current = result.get(record.source);
      if (!current || String(record.sourceUpdatedAt || "").localeCompare(String(current || "")) > 0) {
        result.set(record.source, record.sourceUpdatedAt || null);
      }
      return result;
    }, new Map())].map(([source, updatedAt]) => ({
      source,
      updatedAt,
      connected: true,
      dateLabel: allRecords.find((record) => record.source === source && record.sourceUpdatedAt === updatedAt)?.sourceDateLabel || "Imported",
    }));
    let history = null;
    if (assetId) {
      const [historyAssignments, events, relationships] = await Promise.all([
        supabaseAdmin.from("asset_assignments")
          .select("id,student_id,program_group_id,holder_label,starts_at,ends_at,assignment_status,source_system,source_ref,notes,created_at,updated_at,portal_students(id,display_name,status),program_groups(id,name,status)")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("asset_events")
          .select("id,event_type,occurred_at,actor_staff_id,source_system,source_ref,summary,details,created_at,staff(display_name)")
          .eq("asset_id", assetId)
          .order("occurred_at", { ascending: false }),
        supabaseAdmin.from("asset_relationships")
          .select("id,asset_id,related_asset_id,relationship_type,starts_at,ends_at,source_system,created_at")
          .or(`asset_id.eq.${assetId},related_asset_id.eq.${assetId}`)
          .order("created_at", { ascending: false }),
      ]);
      if (historyAssignments.error || events.error || relationships.error) throw new Error("asset-history-read");
      history = {
        assignments: historyAssignments.data || [],
        events: events.data || [],
        relationships: relationships.data || [],
      };
    }
    await logAudit({
      actor: staffActor(authorization.staff), action: "view",
      table: history ? "assets,asset_assignments,asset_events,asset_relationships" : "assets,asset_assignments",
      recordId: assetId || studentId || requestedCategory || "current-assets",
      route: "/api/admin/assets", changes: { student_scope: studentId || null, category: requestedCategory || null },
    });
    return privateJson({ records, categories, students, requestedStudent: requestedStudent ? { id: requestedStudent.id, name: requestedStudent.display_name } : null, summary, sourceFreshness, history });
  } catch {
    return privateJson({ error: "Could not load current asset records." }, 500);
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const operation = String(body.operation || "").trim().toLowerCase();
  const assignmentOperation = ["assign", "transfer", "return"].includes(operation);
  const capability = assignmentOperation ? STAFF_CAPABILITIES.ASSETS_ASSIGN : STAFF_CAPABILITIES.ASSETS_WRITE;
  const authorization = await authorizeStaffRequest(request, capability);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const assetId = String(body.assetId || "").trim();
  const note = String(body.note || "").trim().slice(0, 500);
  if (!assetId || !["assign", "transfer", "return", "condition", "missing"].includes(operation) || !note) {
    return privateJson({ error: "A valid asset, operation, and note are required." }, 400);
  }
  const { data, error } = await supabaseAdmin.rpc("record_asset_operation_with_audit", {
    p_asset_id: assetId,
    p_operation: operation,
    p_student_id: body.studentId ? String(body.studentId) : null,
    p_condition_summary: String(body.condition || "").trim().slice(0, 500),
    p_operational_status: String(body.operationalStatus || "").trim().slice(0, 100),
    p_note: note,
    p_actor_staff_id: authorization.staff.id,
    p_route: "/api/admin/assets",
  });
  if (error) return privateJson({ error: "Could not record the asset operation." }, 409);
  return privateJson(data);
}
