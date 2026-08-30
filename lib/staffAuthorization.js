import { validateStaffRequest } from "@/lib/staffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeStaffScope,
  staffHasCapability,
  staffScopeAllows,
  staffUsesAssignedScopes,
} from "@/lib/staffCapabilities";

export { staffHasCapability, STAFF_CAPABILITIES } from "@/lib/staffCapabilities";

async function loadActiveScopes(staffId, capability = null) {
  const required = capability == null ? [] : Array.isArray(capability) ? capability : [capability];
  const now = new Date().toISOString();
  let query = supabaseAdmin
    .from("staff_scope_assignments")
    .select("id,capability,scope_type,scope_ref,starts_at,ends_at")
    .eq("staff_id", staffId)
    .lte("starts_at", now);
  if (required.length) query = query.in("capability", ["*", ...required]);
  const { data, error } = await query;
  if (error) throw new Error("Could not verify staff scope.");
  return (data || []).filter((assignment) => !assignment.ends_at || assignment.ends_at > now);
}

export async function authorizeStaffRequest(request, capability, options = {}) {
  const staff = await validateStaffRequest(request);
  if (!staff) return { ok: false, status: 401, error: "Not signed in" };
  if (!staffHasCapability(staff, capability)) {
    return { ok: false, status: 403, error: "This staff account does not have access to this operation." };
  }
  if (!staffUsesAssignedScopes(staff)) return { ok: true, staff, scopes: [] };

  // Capability-only authorization is reserved for record-free responses or a
  // first gate before a route resolves a record's scope and authorizes again.
  // Data must never be returned on the strength of this gate alone.
  if (options.safeCapabilityOnly === true) {
    try {
      const scopes = await loadActiveScopes(staff.id);
      return { ok: true, staff, scopes, requestedScopes: [] };
    } catch {
      return { ok: false, status: 503, error: "Staff scope could not be verified." };
    }
  }

  const requestedScopes = (Array.isArray(options.scopes) ? options.scopes : [options.scope])
    .map(normalizeStaffScope)
    .filter(Boolean);
  try {
    const scopes = await loadActiveScopes(staff.id, capability);
    const collectionScopeType = String(options.collectionScopeType || "").trim();
    if (!requestedScopes.length && collectionScopeType) {
      const required = Array.isArray(capability) ? capability : [capability];
      const global = required.every((item) => staffScopeAllows(scopes, item, { type: "global", ref: "" }));
      if (global) return { ok: true, staff, scopes, requestedScopes: [], scopeFilter: { global: true, refs: [] } };
      const refsByCapability = required.map((item) => new Set(scopes
        .filter((assignment) => (assignment.capability === "*" || assignment.capability === item)
          && assignment.scope_type === collectionScopeType)
        .map((assignment) => String(assignment.scope_ref || ""))
        .filter(Boolean)));
      const refs = [...(refsByCapability[0] || [])]
        .filter((ref) => refsByCapability.every((set) => set.has(ref)));
      if (!refs.length) return { ok: false, status: 403, error: "This staff account is not assigned to any records in this area." };
      return { ok: true, staff, scopes, requestedScopes: [], scopeFilter: { global: false, refs } };
    }
    if (!requestedScopes.length) {
      return {
        ok: false,
        status: 403,
        error: "This limited staff role requires an explicitly scoped operation.",
      };
    }
    if (!requestedScopes.every((requestedScope) => staffScopeAllows(scopes, capability, requestedScope))) {
      return { ok: false, status: 403, error: "This staff account is not assigned to this scope." };
    }
    return { ok: true, staff, scopes, requestedScopes };
  } catch {
    return { ok: false, status: 503, error: "Staff scope could not be verified." };
  }
}
