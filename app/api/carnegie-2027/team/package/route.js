import { zipSync, strToU8 } from "fflate";
import { WorkspaceError } from "@/lib/carnegieWorkspaceModel.mjs";
import {
  workspaceAuth,
  requireWriter,
  workspacePeople,
  readWorkspace,
  readDocument,
  auditWorkspace,
  downloadResponse,
  workspaceFailure,
} from "@/lib/carnegieWorkspaceServer";
export const runtime = "nodejs";
export async function GET(req) {
  try {
    const actor = await workspaceAuth(req);
    requireWriter(actor);
    const current = await readWorkspace();
    const people = await workspacePeople();
    const documents = current.state.documents;
    const selected = documents.filter(
      (d) =>
        d.status === "current" ||
        !documents.some(
          (other) =>
            (other.series_id || other.id) === (d.series_id || d.id) &&
            documents.indexOf(other) > documents.indexOf(d),
        ),
    );
    if (selected.reduce((sum, d) => sum + d.size, 0) > 30000000)
      throw new WorkspaceError(
        "Package exceeds 30 MB. Download individual document versions instead.",
        413,
      );
    const safe = {
      ...current,
      state: {
        ...current.state,
        documents: documents.map(({ object_key: _key, ...doc }) => doc),
      },
      people,
      exported_at: new Date().toISOString(),
      format: "carnegie-workspace-v1",
    };
    const files = {
      "workspace.json": strToU8(JSON.stringify(safe, null, 2)),
      "proposals-template.json": strToU8(
        JSON.stringify(
          {
            format: "carnegie-proposals-v1",
            revision: current.revision,
            proposals: [],
            example: {
              record_id: "copy a record id from workspace.json",
              base_version: 1,
              value: "proposed replacement",
              source: "document name, version and location",
              document_id: null,
            },
          },
          null,
          2,
        ),
      ),
      "READ-ME.txt": strToU8(
        "PRIVATE WORKING PACKAGE\nUse only with a locally approved AI/document tool. Contains internal project material; do not publish.\n\nworkspace.json distinguishes confirmed records, unconfirmed records, proposals, requests and accepted commitments. These structured records control over conflicting document prose. A current working document is not confirmation of every claim inside it. Latest received may require correction.\n\nEdit DOCX/XLSX locally and upload a reviewed new version. Files are immutable; uploads never change confirmed facts. The preview omits layout/images/comments/track-change fidelity and does not recalculate formulas.\n\nFor proposed fact changes, fill proposals-template.json with record_id, exact base_version, proposed value, source, and optional received document_id. Import creates pending proposals only. The record owner must compare evidence and accept. Stale base versions require a fresh comparison, never automatic overwrite. New facts, milestones, decisions and requests are created in the workspace. No AI can accept another person's commitment.\n\nOnly currently selected working versions and latest received versions are included. Older originals remain individually downloadable in document history. No OneDrive sync or migration is implied.\n",
      ),
    };
    for (const doc of selected)
      files[`documents/${doc.id}-${doc.status}-${doc.filename}`] =
        new Uint8Array(await readDocument(doc));
    await auditWorkspace(actor, "package.download");
    return downloadResponse(
      Buffer.from(zipSync(files, { level: 1 })),
      `carnegie-working-package-r${current.revision}.zip`,
      "application/zip",
    );
  } catch (error) {
    return workspaceFailure(error);
  }
}
