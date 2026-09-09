import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import {
  EMPTY_WORKSPACE,
  applyWorkspaceAction,
  importProposals,
  proposalConflicts,
} from "../lib/carnegieWorkspaceModel.mjs";
import { extractOffice } from "../lib/carnegieOffice.mjs";
const owner = { id: "owner", domains: ["coordination", "program"] },
  other = { id: "other", domains: ["coordination"] },
  finance = { id: "finance", domains: ["finance"] };
const people = [owner, other, finance];
const act = (state, command, actor = owner) =>
  applyWorkspaceAction(
    state,
    { source: "Synthetic source", ...command },
    actor,
    people,
    "2026-01-01T12:00:00Z",
  );
const record = (domain = "coordination", owner_id = "owner") =>
  act(EMPTY_WORKSPACE, {
    action: "record.create",
    title: "Synthetic milestone",
    kind: "milestone",
    domain,
    owner_id,
    value: "Receipt verified",
  });
const archive = (files) =>
  zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])),
  );
const word = (text) =>
  archive({
    "word/document.xml": `<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  });
test("new records are unconfirmed; only domain owner confirms", () => {
  let s = record();
  assert.equal(s.records[0].status, "unconfirmed");
  assert.throws(
    () => act(s, { action: "record.confirm", id: s.records[0].id }, other),
    /Only the owner/,
  );
  s = act(s, { action: "record.confirm", id: s.records[0].id });
  assert.equal(s.records[0].status, "confirmed");
  assert.throws(() => record("finance", "owner"), /authorized owner/);
  const f = record("finance", "finance");
  assert.throws(
    () => act(f, { action: "record.confirm", id: f.records[0].id }),
    /Only the owner/,
  );
  assert.equal(
    act(f, { action: "record.confirm", id: f.records[0].id }, finance)
      .records[0].status,
    "confirmed",
  );
});
test("proposals never confirm automatically and stale sibling proposals conflict", () => {
  let s = record();
  const id = s.records[0].id;
  const p = {
    action: "proposal.create",
    record_id: id,
    base_version: 1,
    value: "New proposal",
  };
  s = act(s, p, other);
  s = act(s, { ...p, value: "Sibling" }, other);
  assert.equal(s.records[0].value, "Receipt verified");
  assert.equal(s.records[0].status, "unconfirmed");
  assert.throws(
    () => act(s, { action: "proposal.accept", id: s.proposals[0].id }, other),
    /Only the owner/,
  );
  s = act(s, { action: "proposal.accept", id: s.proposals[0].id });
  assert.equal(s.records[0].value, "New proposal");
  assert.equal(s.proposals[0].reviewed_by, "owner");
  assert.equal(proposalConflicts(s, s.proposals[1]), true);
  assert.throws(
    () => act(s, { action: "proposal.accept", id: s.proposals[1].id }),
    /older record/,
  );
  assert.throws(() => act(s, p), /source record changed/i);
});
test("request acceptance and waiting preserve personal obligation", () => {
  let s = act(EMPTY_WORKSPACE, {
    action: "commitment.request",
    title: "Synthetic request",
    owner_id: "other",
    due: "2026-10-01",
  });
  const id = s.commitments[0].id;
  assert.equal(s.commitments[0].status, "requested");
  assert.throws(
    () => act(s, { action: "commitment.transition", id, status: "accepted" }),
    /Only the owner/,
  );
  assert.throws(
    () =>
      act(
        s,
        { action: "commitment.transition", id, status: "completed" },
        other,
      ),
    /transition/,
  );
  s = act(
    s,
    {
      action: "commitment.transition",
      id,
      status: "accepted",
      due: "2026-10-02",
    },
    other,
  );
  assert.equal(s.commitments[0].accepted_due, "2026-10-02");
  s = act(
    s,
    {
      action: "commitment.transition",
      id,
      status: "waiting",
      dependency: "Awaiting source",
    },
    other,
  );
  assert.equal(s.commitments[0].accepted_by, "other");
  assert.equal(s.commitments[0].owner_id, "other");
  s = act(
    s,
    { action: "commitment.transition", id, status: "completed" },
    other,
  );
  assert.equal(s.commitments[0].accepted_by, "other");
});
test("document receipt cannot alter facts and only owner selects working version", () => {
  let s = record();
  const receive = (id) => ({
    action: "document.receive",
    document: { id, owner_id: "owner", series_id: id === "one" ? null : "one" },
  });
  s = act(s, receive("one"));
  s = act(s, { action: "document.status", id: "one", status: "current" });
  s = act(s, receive("two"));
  assert.equal(s.documents[0].status, "current");
  assert.equal(s.documents[1].status, "received");
  assert.equal(s.records[0].status, "unconfirmed");
  assert.throws(
    () =>
      act(
        s,
        { action: "document.status", id: "two", status: "current" },
        other,
      ),
    /Only the owner/,
  );
  s = act(s, { action: "document.status", id: "two", status: "current" });
  assert.equal(s.documents.filter((d) => d.status === "current").length, 1);
});
test("structured import is atomic, bounded and creates pending proposals only", () => {
  const s = record();
  const payload = {
    format: "carnegie-proposals-v1",
    proposals: [
      {
        record_id: s.records[0].id,
        base_version: 1,
        value: "Revised",
        source: "Synthetic location",
      },
    ],
  };
  const next = importProposals(s, payload, other, people);
  assert.equal(next.proposals[0].status, "pending");
  assert.equal(s.proposals.length, 0);
  assert.equal(next.records[0].value, s.records[0].value);
  assert.throws(
    () =>
      importProposals(
        s,
        {
          ...payload,
          proposals: [
            ...payload.proposals,
            { ...payload.proposals[0], base_version: 99 },
          ],
        },
        other,
        people,
      ),
    /source record changed/i,
  );
  assert.equal(s.proposals.length, 0);
});
test("DOCX text is inert and credential-bearing content is rejected", () => {
  const result = extractOffice(
    word("&lt;script&gt;alert(1)&lt;/script&gt;"),
    "fixture.docx",
  );
  assert.match(result.sections[0].text, /<script>alert/);
  assert.throws(
    () => extractOffice(word("PIN: 123456"), "fixture.docx"),
    /credential/,
  );
  assert.throws(
    () => extractOffice(word("ok"), "fixture.xlsm"),
    /DOCX or XLSX/,
  );
});
test("archive/XML hazards rejected", () => {
  assert.throws(
    () =>
      extractOffice(
        archive({
          "word/document.xml": '<!DOCTYPE x [<!ENTITY a "boom">]><x>&a;</x>',
        }),
        "x.docx",
      ),
    /XML/,
  );
  assert.throws(
    () => extractOffice(archive({ "word/vbaProject.bin": "x" }), "x.docx"),
    /macros/,
  );
  assert.throws(
    () => extractOffice(archive({ "../word/document.xml": "x" }), "x.docx"),
    /paths/,
  );
  assert.throws(
    () =>
      extractOffice(
        archive({ "word/document.xml": "x".repeat(6100000) }),
        "x.docx",
      ),
    /limit/,
  );
  assert.throws(
    () =>
      extractOffice(
        archive({
          "word/document.xml": "<x/>",
          "word/_rels/document.xml.rels":
            '<Relationships><Relationship TargetMode="External" Type="attachedTemplate" Target="https://example.invalid"/></Relationships>',
        }),
        "x.docx",
      ),
    /external templates/,
  );
});
test("XLSX includes named sheets, cell references, cached formula values, and hidden text screening", () => {
  const files = {
    "xl/workbook.xml":
      '<workbook><sheets><sheet name="Plan" r:id="r1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": "<sst><si><t>Pending evidence</t></si></sst>",
    "xl/worksheets/sheet1.xml":
      '<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>',
  };
  const result = extractOffice(archive(files), "fixture.xlsx");
  assert.equal(result.sections[0].title, "Plan");
  assert.match(result.sections[0].text, /A1: Pending evidence/);
  assert.match(
    result.sections[0].text,
    /B1: 2 \[formula: 1\+1; cached value only\]/,
  );
  assert.throws(
    () =>
      extractOffice(
        archive({
          ...files,
          "xl/comments1.xml":
            "<comments><t>password: secretvalue</t></comments>",
        }),
        "fixture.xlsx",
      ),
    /credential/,
  );
});
