import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { privateJson } from "@/lib/privateResponse";
import {
  applyWorkspaceAction,
  WorkspaceError,
} from "@/lib/carnegieWorkspaceModel.mjs";
import {
  workspaceAuth,
  workspacePeople,
  readWorkspace,
  saveWorkspace,
  auditWorkspace,
  checkRevision,
  readJson,
  workspaceFailure,
  downloadResponse,
} from "@/lib/carnegieWorkspaceServer";
export const runtime = "nodejs";
export async function GET(req) {
  try {
    const actor = await workspaceAuth(req);
    const requestedRevision = new URL(req.url).searchParams.get("revision");
    if (requestedRevision !== null) {
      const revision = Number(requestedRevision);
      if (!Number.isInteger(revision) || revision < 1)
        throw new WorkspaceError("Invalid history revision.");
      const { data: snapshot, error } = await db
        .from("carnegie_workspace_history")
        .select("revision,actor_id,action,source,created_at,state")
        .eq("revision", revision)
        .single();
      if (error || !snapshot)
        throw new WorkspaceError("History revision not found.", 404);
      snapshot.state.documents = snapshot.state.documents.map(
        ({ object_key: _key, ...doc }) => doc,
      );
      await auditWorkspace(actor, "history.download");
      return downloadResponse(
        Buffer.from(JSON.stringify(snapshot, null, 2)),
        `carnegie-history-r${revision}.json`,
        "application/json",
      );
    }
    const current = await readWorkspace();
    const people = await workspacePeople();
    const { data: history, error } = await db
      .from("carnegie_workspace_history")
      .select("revision,actor_id,action,source,created_at")
      .order("revision", { ascending: false })
      .limit(100);
    if (error) throw new Error("history read");
    await auditWorkspace(actor, "view");
    // Object paths never leave the server; downloads resolve immutable IDs.
    return privateJson({
      ...current,
      state: {
        ...current.state,
        documents: current.state.documents.map(
          ({ object_key: _key, ...doc }) => doc,
        ),
      },
      actor,
      people,
      history,
    });
  } catch (error) {
    return workspaceFailure(error);
  }
}
export async function POST(req) {
  try {
    const actor = await workspaceAuth(req, true);
    const command = await readJson(req);
    if (command.action === "document.receive")
      throw new WorkspaceError("Use the document upload form.");
    const current = await readWorkspace();
    checkRevision(command, current);
    const state = applyWorkspaceAction(
      current.state,
      command,
      actor,
      await workspacePeople(),
    );
    const revision = await saveWorkspace(current, state, actor, command);
    return privateJson({ revision });
  } catch (error) {
    return workspaceFailure(error);
  }
}
