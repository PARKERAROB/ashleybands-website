import { unzipSync, strFromU8 } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { WorkspaceError, textField } from "./carnegieWorkspaceModel.mjs";
export const MAX_UPLOAD = 3000000;
export const OFFICE_TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const list = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  trimValues: false,
});
function xml(value) {
  if (
    /<!DOCTYPE|<!ENTITY|\x00/i.test(value) ||
    XMLValidator.validate(value) !== true
  )
    throw new WorkspaceError(
      "Unsupported or invalid Office XML. Save a fresh DOCX/XLSX copy.",
    );
  return parser.parse(value);
}
function allText(node) {
  if (node == null) return "";
  if (typeof node !== "object") return String(node);
  return Object.entries(node)
    .filter(([k]) => !k.startsWith("@_"))
    .map(([, v]) => list(v).map(allText).join(""))
    .join("");
}
function wordPreview(source) {
  const ordered = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
  }).parse(source);
  let output = "";
  function walk(nodes) {
    for (const node of nodes || [])
      for (const [tag, children] of Object.entries(node)) {
        if (tag === "#text") output += String(children);
        else if (tag === "w:tab") output += "\t";
        else if (tag === "w:br") output += "\n";
        else if (Array.isArray(children)) {
          walk(children);
          if (tag === "w:p" || tag === "w:tr") output += "\n";
          if (tag === "w:tc") output += "\t";
        }
      }
  }
  walk(ordered);
  return output.trim();
}
export function extractOffice(bytes, filename) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!OFFICE_TYPES[extension] || bytes.length > MAX_UPLOAD || !bytes.length)
    throw new WorkspaceError("Choose a DOCX or XLSX file up to 3 MB.");
  let expanded = 0,
    entries = 0;
  const names = new Set();
  try {
    unzipSync(bytes, {
      filter(meta) {
        if (
          ++entries > 300 ||
          meta.originalSize > 6000000 ||
          (expanded += meta.originalSize) > 12000000 ||
          !Number.isSafeInteger(meta.originalSize)
        )
          throw new WorkspaceError(
            "This document expands beyond the preview limit.",
          );
        if (
          names.has(meta.name) ||
          /(^\/|\\|(^|\/)\.\.?(\/|$))/.test(meta.name)
        )
          throw new WorkspaceError("Invalid archive paths.");
        names.add(meta.name);
        if (
          /vbaProject|embeddings\/|activeX\/|externalLinks\/|\.bin$|\.exe$|\.js$/i.test(
            meta.name,
          )
        )
          throw new WorkspaceError(
            "Remove macros, embedded objects, or external data connections before uploading.",
          );
        return false;
      },
    });
    const files = unzipSync(bytes);
    let scanned = "";
    for (const [name, content] of Object.entries(files)) {
      if (/\.(xml|rels)$/.test(name)) {
        const raw = strFromU8(content);
        const tree = xml(raw);
        scanned += allText(tree) + "\n";
        if (name.endsWith(".rels"))
          for (const rel of list(tree.Relationships?.Relationship)) {
            if (
              rel["@_TargetMode"] === "External" &&
              !String(rel["@_Type"]).endsWith("/hyperlink")
            )
              throw new WorkspaceError(
                "Remove external templates or linked data before uploading.",
              );
          }
      }
    }
    textField(scanned, "document content", 12000000, true);
    let sections;
    if (extension === "docx") {
      if (!files["word/document.xml"] || files["xl/workbook.xml"])
        throw new WorkspaceError("File contents do not match DOCX.");
      sections = [
        {
          title: "Document text and tables",
          text: wordPreview(strFromU8(files["word/document.xml"])),
        },
      ];
    } else {
      if (!files["xl/workbook.xml"] || files["word/document.xml"])
        throw new WorkspaceError("File contents do not match XLSX.");
      const workbook = xml(strFromU8(files["xl/workbook.xml"]));
      const relationships = xml(
        strFromU8(files["xl/_rels/workbook.xml.rels"] || new Uint8Array()),
      );
      const shared = files["xl/sharedStrings.xml"]
        ? list(xml(strFromU8(files["xl/sharedStrings.xml"])).sst?.si).map(
            allText,
          )
        : [];
      sections = list(workbook.workbook?.sheets?.sheet).map((sheet) => {
        const rel = list(relationships.Relationships?.Relationship).find(
          (r) => r["@_Id"] === sheet["@_r:id"],
        );
        const target = String(rel?.["@_Target"] || "");
        const path = target.startsWith("/xl/")
          ? target.slice(1)
          : `xl/${target}`;
        if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path) || !files[path])
          throw new WorkspaceError("Unsupported worksheet relationship.");
        const worksheet = xml(strFromU8(files[path]));
        const cells = list(worksheet.worksheet?.sheetData?.row).flatMap((row) =>
          list(row.c).map((cell) => {
            const v = allText(cell.v);
            const value =
              cell["@_t"] === "s"
                ? (shared[Number(v)] ?? "[missing shared text]")
                : cell["@_t"] === "inlineStr"
                  ? allText(cell.is)
                  : v;
            return `${cell["@_r"] || "?"}: ${value}${cell.f != null ? ` [formula: ${allText(cell.f)}; cached value only]` : ""}`;
          }),
        );
        return {
          title: String(sheet["@_name"] || "Worksheet"),
          text: cells.join("\n"),
        };
      });
    }
    const length = sections.reduce((n, s) => n + s.text.length, 0);
    if (length > 120000 || sections.length > 30)
      throw new WorkspaceError(
        "Preview is too large. Split this document into smaller working files.",
      );
    return {
      extension,
      mime: OFFICE_TYPES[extension],
      sections,
      note: "Content preview only. Layout, images, comments and tracked changes are not fully represented. Formulas are not calculated; workbook values may be stale. Open the original locally for full review.",
    };
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError(
      "This Office file could not be safely read. Save a fresh DOCX/XLSX copy.",
    );
  }
}
