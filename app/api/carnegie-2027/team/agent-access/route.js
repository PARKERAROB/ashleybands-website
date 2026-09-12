import { randomBytes, randomUUID } from "node:crypto";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { privateJson } from "@/lib/privateResponse";
import { hashAgentToken } from "@/lib/carnegieAgent";
import { textField, WorkspaceError } from "@/lib/carnegieWorkspaceModel.mjs";
import { workspaceAuth, requireWriter, auditWorkspace, readJson, workspaceFailure } from "@/lib/carnegieWorkspaceServer";
export const runtime = "nodejs";
export async function GET(req) {
  try {
    const actor = await workspaceAuth(req);
    requireWriter(actor);
    const { data, error } = await db.from("carnegie_workspace_agent_keys").select("id,label,created_at,expires_at,revoked_at").eq("staff_id", actor.id).order("created_at", { ascending: false });
    if (error) throw new WorkspaceError("Agent access could not be read.", 503);
    await auditWorkspace(actor, "agent.keys.view");
    return privateJson({ keys: data });
  } catch (error) { return workspaceFailure(error); }
}
export async function POST(req) {
  try {
    const actor = await workspaceAuth(req, true);
    const command = await readJson(req, 3000);
    if (command.action === "revoke") {
      if (!/^[a-f0-9-]{36}$/.test(command.id || "")) throw new WorkspaceError("Choose a key.");
      const { error } = await db.from("carnegie_workspace_agent_keys").update({ revoked_at: new Date().toISOString() }).eq("staff_id", actor.id).eq("id", command.id);
      if (error) throw new WorkspaceError("Could not revoke access.", 503);
      await auditWorkspace(actor, "agent.key.revoke");
      return privateJson({ revoked: true });
    }
    if (command.action !== "create") throw new WorkspaceError("Choose create or revoke.");
    const label = textField(command.label, "key name", 80);
    const token = `cw_${randomBytes(32).toString("hex")}`;
    const expires_at = new Date(Date.now() + 90 * 86400000).toISOString();
    const { error } = await db.from("carnegie_workspace_agent_keys").insert({ id: randomUUID(), staff_id: actor.id, token_hash: hashAgentToken(token), label, expires_at, source: "Self-issued through authenticated workspace settings" });
    if (error) throw new WorkspaceError("Could not create access.", 503);
    await auditWorkspace(actor, "agent.key.create");
    return privateJson({ workspace_key: token, expires_at });
  } catch (error) { return workspaceFailure(error); }
}
