import { privateJson } from "@/lib/privateResponse";
import { importProposals } from "@/lib/carnegieWorkspaceModel.mjs";
import {
  workspaceAuth,
  workspacePeople,
  readWorkspace,
  saveWorkspace,
  checkRevision,
  readJson,
  workspaceFailure,
} from "@/lib/carnegieWorkspaceServer";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    const actor = await workspaceAuth(req, true);
    const payload = await readJson(req);
    const current = await readWorkspace();
    checkRevision(payload, current);
    const state = importProposals(
      current.state,
      payload,
      actor,
      await workspacePeople(),
    );
    const revision = await saveWorkspace(current, state, actor, {
      action: "proposal.import",
      source:
        "Explicit structured proposal import; each proposal retains its supplied source.",
    });
    return privateJson({ revision, received: payload.proposals.length });
  } catch (error) {
    return workspaceFailure(error);
  }
}
