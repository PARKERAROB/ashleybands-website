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
    const requestedCategory = url.searchParams.get("category") || "";
    const requestedStatus = url.searchParams.get("status") || "";
    const [{ data: assets, error: assetError }, { data: assignments, error: assignmentError }, { data: requestedStudent, error: studentError }] = await Promise.all([
      supabaseAdmin.from("assets")
        .select("id,asset_type,asset_tag,display_name,lifecycle_status,operational_status,condition_summary,location,source_system,source_key,last_verified_at,source_updated_at,updated_at,metadata,asset_instruments(instrument_type,brand,model,model_markings,serial_number,serial_location,finish,key_pitch,level,play_status,repair_needed,repair_priority,visible_issues),asset_locks(serial_number,confidence,inventoried)")
        .eq("lifecycle_status", "active")
        .order("asset_type", { ascending: true })
        .order("display_name", { ascending: true })
        .limit(2000),
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
      const category = CATEGORY[asset.asset_type] || { id: asset.asset_type, label: title(asset.asset_type), connected: true, dedicatedHref: "" };
      const details = [];
      if (instrument) {
        details.push(["Brand", instrument.brand || "Not recorded"], ["Model", instrument.model || instrument.model_markings || "Not recorded"], ["Serial", instrument.serial_number || "Not recorded"], ["Play status", title(instrument.play_status) || "Not recorded"]);
        if (instrument.repair_needed) details.push(["Repair", instrument.repair_needed]);
      }
      if (lock) details.push(["Serial", lock.serial_number || "Not recorded"], ["Inventoried", lock.inventoried == null ? "Not recorded" : lock.inventoried ? "Yes" : "No"]);
      if (asset.asset_type === "tuner") details.push(["Tuner number", asset.metadata?.tuner_number || asset.asset_tag || "Not recorded"]);
      if (asset.asset_type === "locker") details.push(["Locker", asset.metadata?.locker_number || asset.asset_tag || "Not recorded"]);
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
    await logAudit({
      actor: staffActor(authorization.staff), action: "view",
      table: "assets,asset_assignments", recordId: studentId || requestedCategory || "current-assets",
      route: "/api/admin/assets", changes: { student_scope: studentId || null, category: requestedCategory || null },
    });
    return privateJson({ records, categories, students, requestedStudent: requestedStudent ? { id: requestedStudent.id, name: requestedStudent.display_name } : null, summary, sourceFreshness });
  } catch {
    return privateJson({ error: "Could not load current asset records." }, 500);
  }
}
