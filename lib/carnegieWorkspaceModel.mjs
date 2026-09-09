import { randomUUID } from "node:crypto";
export const EMPTY_WORKSPACE = {
  records: [],
  proposals: [],
  commitments: [],
  documents: [],
};
export const DOMAINS = ["coordination", "program", "finance"];
export class WorkspaceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function textField(value, name, max = 2000, optional = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!optional && !value.trim())
  )
    throw new WorkspaceError(`Check ${name}.`);
  const text = value.trim();
  if (
    /(?:password|passcode|\bpin\b|api[_ -]?key|secret|session[_ -]?token)\s*[:=]\s*\S+|-----BEGIN [\w ]*PRIVATE KEY|\b(?:sk|sb_secret)_[a-zA-Z0-9_-]{12,}/i.test(
      text,
    )
  )
    throw new WorkspaceError(
      "Possible credential found. Remove access credentials before saving.",
    );
  return text;
}
function oneOf(value, values, label) {
  if (!values.includes(value)) throw new WorkspaceError(`Check ${label}.`);
  return value;
}
function find(rows, id) {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new WorkspaceError("Record not found.", 404);
  return row;
}
function owns(row, actor) {
  if (row.owner_id !== actor.id)
    throw new WorkspaceError("Only the owner can make this change.", 403);
}
function ownerFor(people, id, domain) {
  const person = people.find(
    (p) => p.id === id && (!domain || p.domains.includes(domain)),
  );
  if (!person)
    throw new WorkspaceError("Choose an authorized owner for this area.");
  return person.id;
}
function stamp(row, actor, now) {
  row.updated_by = actor.id;
  row.updated_at = now;
  row.version = (row.version || 0) + 1;
}
export function proposalConflicts(state, proposal) {
  const record = state.records.find((r) => r.id === proposal.record_id);
  return !record || record.version !== proposal.base_version;
}
export function applyWorkspaceAction(
  original,
  command,
  actor,
  people,
  now = new Date().toISOString(),
) {
  const state = structuredClone(original);
  const id = randomUUID();
  const source = textField(command.source, "source", 1000);
  switch (command.action) {
    case "record.create": {
      const domain = oneOf(command.domain, DOMAINS, "area");
      state.records.push({
        id,
        kind: oneOf(
          command.kind,
          ["fact", "milestone", "decision"],
          "record type",
        ),
        domain,
        title: textField(command.title, "title", 160),
        value: textField(command.value, "value"),
        owner_id: ownerFor(people, command.owner_id, domain),
        status: "unconfirmed",
        source,
        version: 1,
        created_by: actor.id,
        updated_by: actor.id,
        updated_at: now,
      });
      break;
    }
    case "record.confirm": {
      const row = find(state.records, command.id);
      owns(row, actor);
      if (!actor.domains.includes(row.domain))
        throw new WorkspaceError(
          "This area requires its authorized owner.",
          403,
        );
      if (row.status === "confirmed")
        throw new WorkspaceError(
          "This record is already confirmed. Propose a change instead.",
        );
      row.status = "confirmed";
      row.source = source;
      stamp(row, actor, now);
      break;
    }
    case "proposal.create": {
      const row = find(state.records, command.record_id);
      if (command.base_version !== row.version)
        throw new WorkspaceError(
          "The source record changed. Refresh and compare again.",
          409,
        );
      const document = command.document_id
        ? find(state.documents, command.document_id)
        : null;
      state.proposals.push({
        id,
        record_id: row.id,
        base_version: row.version,
        base_value: row.value,
        value: textField(command.value, "proposed value"),
        source,
        document_id: document?.id || null,
        status: "pending",
        created_by: actor.id,
        created_at: now,
      });
      break;
    }
    case "proposal.accept":
    case "proposal.reject": {
      const proposal = find(state.proposals, command.id);
      const row = find(state.records, proposal.record_id);
      owns(row, actor);
      if (!actor.domains.includes(row.domain))
        throw new WorkspaceError(
          "This area requires its authorized owner.",
          403,
        );
      if (proposal.status !== "pending")
        throw new WorkspaceError("This proposal was already reviewed.", 409);
      if (command.action === "proposal.accept") {
        if (proposalConflicts(state, proposal))
          throw new WorkspaceError(
            "This proposal is based on an older record. Create a fresh proposal after comparing it.",
            409,
          );
        row.value = proposal.value;
        row.status = "confirmed";
        row.source = proposal.source;
        row.source_document_id = proposal.document_id;
        stamp(row, actor, now);
      }
      proposal.status =
        command.action === "proposal.accept" ? "accepted" : "rejected";
      proposal.reviewed_by = actor.id;
      proposal.reviewed_at = now;
      proposal.review_source = source;
      break;
    }
    case "commitment.request": {
      state.commitments.push({
        id,
        title: textField(command.title, "request", 240),
        owner_id: ownerFor(people, command.owner_id),
        requested_by: actor.id,
        status: "requested",
        requested_due: textField(command.due || "", "suggested date", 10, true),
        accepted_due: null,
        source,
        version: 1,
        created_at: now,
        updated_at: now,
      });
      break;
    }
    case "commitment.transition": {
      const row = find(state.commitments, command.id);
      owns(row, actor);
      const allowed = {
        requested: ["accepted", "declined"],
        accepted: ["waiting", "completed"],
        waiting: ["accepted", "completed"],
        completed: ["accepted"],
        declined: [],
      };
      oneOf(command.status, allowed[row.status] || [], "commitment transition");
      if (command.status === "accepted" && !row.accepted_at) {
        row.accepted_at = now;
        row.accepted_by = actor.id;
        row.accepted_due = textField(
          command.due || "",
          "accepted date",
          10,
          true,
        );
      }
      row.status = command.status;
      row.dependency = textField(
        command.dependency || "",
        "dependency",
        500,
        command.status !== "waiting",
      );
      row.source = source;
      stamp(row, actor, now);
      break;
    }
    case "document.receive": {
      // Metadata is constructed exclusively by the validated upload handler.
      const doc = command.document;
      if (
        !doc ||
        doc.owner_id !== actor.id ||
        state.documents.some((d) => d.id === doc.id)
      )
        throw new WorkspaceError("Invalid document receipt.");
      if (doc.series_id) {
        const root = find(state.documents, doc.series_id);
        owns(root, actor);
        if (root.series_id) throw new WorkspaceError("Choose the original document series for a new version.");
      }
      state.documents.push({
        ...doc,
        status: "received",
        received_by: actor.id,
        received_at: now,
        source,
      });
      break;
    }
    case "document.status": {
      const doc = find(state.documents, command.id);
      owns(doc, actor);
      oneOf(
        command.status,
        ["current", "needs_correction", "received"],
        "document status",
      );
      if (command.status === "current") {
        state.documents
          .filter(
            (d) =>
              (d.series_id || d.id) === (doc.series_id || doc.id) &&
              d.status === "current",
          )
          .forEach((d) => {
            d.status = "received";
          });
      }
      doc.status = command.status;
      doc.status_source = source;
      doc.status_by = actor.id;
      doc.status_at = now;
      break;
    }
    default:
      throw new WorkspaceError("Unknown workspace action.");
  }
  if (
    Object.values(state).some((rows) => rows.length > 500) ||
    JSON.stringify(state).length > 3500000
  )
    throw new WorkspaceError(
      "Workspace capacity reached. Contact the director before adding more.",
    );
  return state;
}
export function importProposals(state, payload, actor, people, now) {
  if (
    payload?.format !== "carnegie-proposals-v1" ||
    !Array.isArray(payload.proposals) ||
    !payload.proposals.length ||
    payload.proposals.length > 50
  )
    throw new WorkspaceError(
      "Use the proposals template from a working package (1–50 proposals).",
    );
  return payload.proposals.reduce(
    (next, p) =>
      applyWorkspaceAction(
        next,
        { ...p, action: "proposal.create" },
        actor,
        people,
        now,
      ),
    state,
  );
}
