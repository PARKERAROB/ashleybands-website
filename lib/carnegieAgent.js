import { createHash } from "node:crypto";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { workspaceActor } from "@/lib/carnegieWorkspaceServer";
import { WorkspaceError } from "@/lib/carnegieWorkspaceModel.mjs";

export const hashAgentToken = (token) => createHash("sha256").update(token).digest("hex");
export async function agentActor(req) {
  const token = req.headers.get("authorization")?.match(/^Bearer (cw_[a-f0-9]{64})$/)?.[1];
  if (!token) throw new WorkspaceError("A workspace agent key is required.", 401);
  const { data: key, error } = await db.from("carnegie_workspace_agent_keys")
    .select("id,staff_id,expires_at,revoked_at").eq("token_hash", hashAgentToken(token)).maybeSingle();
  if (error || !key || key.revoked_at || !Number.isFinite(Date.parse(key.expires_at)) || Date.parse(key.expires_at) <= Date.now())
    throw new WorkspaceError("The workspace agent key is invalid or expired.", 401);
  const { data: staff } = await db.from("staff").select("id,role,display_name,disabled_at")
    .eq("id", key.staff_id).is("disabled_at", null).maybeSingle();
  if (!staff) throw new WorkspaceError("This account is unavailable.", 401);
  return workspaceActor(staff, true);
}
export const AGENT_ACTIONS = ["coordination.save", "record.create", "record.confirm", "record.share", "proposal.create", "proposal.accept", "proposal.reject", "commitment.request", "commitment.transition"];
