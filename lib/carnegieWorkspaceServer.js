import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";
import { privateJson } from "@/lib/privateResponse";
import { WorkspaceError } from "@/lib/carnegieWorkspaceModel.mjs";
export const BUCKET = "carnegie-workspace";
export async function workspaceAuth(req, write = false) {
  if (write && req.headers.get("origin") !== new URL(req.url).origin)
    throw new WorkspaceError("Use this workspace from its own website.", 403);
  const staff = await validateStaffRequest(req);
  if (!staff)
    throw new WorkspaceError("Sign in with your existing staff account.", 401);
  return workspaceActor(staff, write);
}
export async function workspaceActor(staff, write = false) {
  const { data: workspace, error: ownerError } = await db
    .from("carnegie_workspace")
    .select("primary_owner_id")
    .eq("id", true)
    .single();
  if (ownerError)
    throw new WorkspaceError("Workspace access is not configured yet.", 503);
  const isPrimary =
    staff.role === "director" && staff.id === workspace.primary_owner_id;
  const { data: membership, error } = await db
    .from("carnegie_workspace_members")
    .select("domains,access")
    .eq("staff_id", staff.id)
    .maybeSingle();
  if (error)
    throw new WorkspaceError("Workspace access is not configured yet.", 503);
  if (!isPrimary && !membership)
    throw new WorkspaceError(
      "This account has not been granted private coordination access. Campaign research access is separate.",
      403,
    );
  const domains = [
    ...new Set([
      ...(isPrimary ? ["program", "coordination"] : []),
      ...(membership?.domains || []),
    ]),
  ];
  const access = isPrimary ? "writer" : membership?.access || "writer";
  if (write && access !== "writer") throw new WorkspaceError("This is read-only access.", 403);
  return { id: staff.id, display_name: staff.display_name, domains, access, is_primary: isPrimary };
}
export function requireWriter(actor) {
  if (actor.access !== "writer") throw new WorkspaceError("This material is available only to workspace writers.", 403);
}
export async function workspacePeople() {
  const { data: members, error } = await db
    .from("carnegie_workspace_members")
    .select("staff_id,domains,access");
  if (error) throw new Error("membership read");
  const ids = members.filter((m) => m.access !== "viewer").map((m) => m.staff_id);
  const { data: workspace, error: ownerError } = await db
    .from("carnegie_workspace")
    .select("primary_owner_id")
    .eq("id", true)
    .single();
  if (ownerError) throw new Error("owner read");
  const { data: directors, error: directorError } = workspace.primary_owner_id
    ? await db
        .from("staff")
        .select("id,display_name")
        .eq("id", workspace.primary_owner_id)
        .eq("role", "director")
        .is("disabled_at", null)
    : { data: [], error: null };
  const directorRows = Array.isArray(directors)
    ? directors
    : directors
      ? [directors]
      : [];
  if (directorError) throw new Error("director read");
  const { data: invited, error: memberError } = ids.length
    ? await db
        .from("staff")
        .select("id,display_name")
        .in("id", ids)
        .is("disabled_at", null)
    : { data: [], error: null };
  if (memberError) throw new Error("member read");
  return [
    ...new Map([...directorRows, ...invited].map((p) => [p.id, p])).values(),
  ].map((p) => ({
    ...p,
    domains: [
      ...new Set([
        ...(directorRows.some((d) => d.id === p.id)
          ? ["program", "coordination"]
          : []),
        ...(members.find((m) => m.staff_id === p.id)?.domains || []),
      ]),
    ],
  }));
}
export async function readWorkspace() {
  const { data, error } = await db
    .from("carnegie_workspace")
    .select("revision,state,updated_at")
    .eq("id", true)
    .single();
  if (error) throw new WorkspaceError("Workspace storage is not ready.", 503);
  return data;
}
export async function saveWorkspace(current, state, actor, command) {
  const { data, error } = await db.rpc("save_carnegie_workspace", {
    p_revision: current.revision,
    p_state: state,
    p_actor: actor.id,
    p_action: command.action,
    p_source: command.source,
  });
  if (error?.code === "40001")
    throw new WorkspaceError(
      "Someone saved a newer version. Refresh, compare, and try again.",
      409,
    );
  if (error)
    throw new WorkspaceError(
      "The change could not be saved. Refresh before retrying.",
      503,
    );
  await auditWorkspace(actor, command.action);
  return data;
}
export async function auditWorkspace(actor, action) {
  await logAudit({
    actor: staffActor(actor),
    action,
    table: "carnegie_workspace",
    recordId: "carnegie",
    route: "/api/carnegie-2027/team",
  });
}
export function checkRevision(command, current) {
  if (
    !Number.isInteger(command.revision) ||
    command.revision !== current.revision
  )
    throw new WorkspaceError(
      "This view is out of date. Refresh before saving.",
      409,
    );
}
export async function readJson(req, limit = 100000) {
  const bytes = await readLimited(req, limit);
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new WorkspaceError("Invalid JSON.");
  }
}
export async function readLimited(req, limit) {
  if (Number(req.headers.get("content-length")) > limit)
    throw new WorkspaceError("Upload is too large.", 413);
  const chunks = [];
  let size = 0;
  const reader = req.body?.getReader();
  if (!reader) throw new WorkspaceError("Request body is missing.");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new WorkspaceError("Upload is too large.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function workspaceFailure(error) {
  // Do not log database messages or untrusted document text.
  return privateJson(
    {
      error:
        error instanceof WorkspaceError
          ? error.message
          : "Workspace request failed. Please retry.",
    },
    error instanceof WorkspaceError ? error.status : 500,
  );
}
export function downloadResponse(bytes, filename, type) {
  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
export async function readDocument(doc) {
  const { data: buckets, error: bucketError } =
    await db.storage.getBucket(BUCKET);
  if (bucketError || buckets?.public !== false)
    throw new WorkspaceError(
      "Private document storage could not be verified.",
      503,
    );
  const { data, error } = await db.storage
    .from(BUCKET)
    .download(doc.object_key);
  if (error) throw new WorkspaceError("Document could not be downloaded.", 503);
  const bytes = Buffer.from(await data.arrayBuffer());
  const { createHash } = await import("node:crypto");
  if (createHash("sha256").update(bytes).digest("hex") !== doc.sha256)
    throw new WorkspaceError("Document integrity check failed.", 503);
  return bytes;
}
