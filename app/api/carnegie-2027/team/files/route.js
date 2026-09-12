import { randomUUID, createHash } from "node:crypto";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { privateJson } from "@/lib/privateResponse";
import { extractOffice, MAX_UPLOAD } from "@/lib/carnegieOffice.mjs";
import {
  applyWorkspaceAction,
  textField,
  WorkspaceError,
} from "@/lib/carnegieWorkspaceModel.mjs";
import {
  BUCKET,
  workspaceAuth,
  requireWriter,
  workspacePeople,
  readWorkspace,
  saveWorkspace,
  auditWorkspace,
  checkRevision,
  readLimited,
  workspaceFailure,
  downloadResponse,
  readDocument,
} from "@/lib/carnegieWorkspaceServer";
export const runtime = "nodejs";
export async function POST(req) {
  try {
    const actor = await workspaceAuth(req, true);
    const url = new URL(req.url);
    const current = await readWorkspace();
    checkRevision(
      { revision: Number(url.searchParams.get("revision")) },
      current,
    );
    if (req.headers.get("x-reviewed-content") !== "yes")
      throw new WorkspaceError(
        "Review the entire original for credentials and restricted content before uploading.",
      );
    const filename = textField(url.searchParams.get("name"), "filename", 160);
    if (!/^[\w .()-]+\.(docx|xlsx)$/i.test(filename))
      throw new WorkspaceError(
        "Use a simple filename ending in .docx or .xlsx.",
      );
    const source = textField(url.searchParams.get("source"), "source", 1000);
    const bytes = await readLimited(req, MAX_UPLOAD);
    const preview = extractOffice(bytes, filename);
    const id = randomUUID();
    const series = url.searchParams.get("series") || null;
    const document = {
      id,
      series_id: series,
      filename,
      owner_id: actor.id,
      object_key: `versions/${id}.${preview.extension}`,
      mime: preview.mime,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      preview,
    };
    const command = { action: "document.receive", source, document };
    const state = applyWorkspaceAction(
      current.state,
      command,
      actor,
      await workspacePeople(),
    );
    const { data: bucket, error: bucketError } =
      await db.storage.getBucket(BUCKET);
    if (bucketError || bucket.public !== false)
      throw new WorkspaceError("Private storage is not ready.", 503);
    const { error } = await db.storage
      .from(BUCKET)
      .upload(document.object_key, bytes, {
        contentType: document.mime,
        upsert: false,
      });
    if (error)
      throw new WorkspaceError(
        "The document could not be stored. No project facts were changed.",
        503,
      );
    // A CAS failure leaves an inaccessible orphan, never an overwritten version.
    const revision = await saveWorkspace(current, state, actor, command);
    return privateJson({ revision, id });
  } catch (error) {
    return workspaceFailure(error);
  }
}
export async function GET(req) {
  try {
    const actor = await workspaceAuth(req);
    requireWriter(actor);
    const current = await readWorkspace();
    const doc = current.state.documents.find(
      (d) => d.id === new URL(req.url).searchParams.get("id"),
    );
    if (!doc) throw new WorkspaceError("Document not found.", 404);
    const bytes = await readDocument(doc);
    await auditWorkspace(actor, "document.download");
    return downloadResponse(bytes, doc.filename, doc.mime);
  } catch (error) {
    return workspaceFailure(error);
  }
}
