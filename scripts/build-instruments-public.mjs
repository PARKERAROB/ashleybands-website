import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = "/Users/parkerarob/Desktop/BandsofAHS/data/instrument-inventory-merged.csv";
const OUTPUT = path.join(process.cwd(), "content", "instruments-public.json");

const PUBLIC_FIELDS = [
  "asset_id",
  "instrument_type",
  "brand",
  "model",
  "model_markings",
  "serial_number",
  "finish",
  "key_pitch",
  "level",
  "condition",
  "play_status",
  "location",
  "locker",
  "visible_issues",
  "repair_needed",
  "repair_priority",
  "last_verified_date",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }

  return rows;
}

function clean(value) {
  return String(value || "").trim();
}

const csv = await readFile(SOURCE, "utf8");
const [headers, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ""));

if (!headers?.length) {
  throw new Error(`No headers found in ${SOURCE}`);
}

const instruments = rows
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, clean(row[index])])))
  .filter((row) => row.asset_id || row.instrument_type || row.serial_number)
  .map((row) => Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, clean(row[field])])))
  .sort((a, b) => {
    const type = a.instrument_type.localeCompare(b.instrument_type, undefined, { sensitivity: "base" });
    if (type) return type;
    const brand = a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" });
    if (brand) return brand;
    return a.asset_id.localeCompare(b.asset_id, undefined, { numeric: true, sensitivity: "base" });
  });

const snapshot = {
  generatedAt: new Date().toISOString(),
  source: "BDOS instrument-inventory-merged.csv sanitized public snapshot",
  count: instruments.length,
  instruments,
};

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Wrote ${instruments.length} public instruments to ${OUTPUT}`);
