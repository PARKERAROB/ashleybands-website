// Marcher counts for public pages, taken from the BandsofAHS roster (students.csv).
export function parseCsv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function countMarchers(csvText) {
  const [header, ...rows] = parseCsv(csvText);
  const status = header.indexOf("status"), role = header.indexOf("mb_role_2026");
  if (status < 0 || role < 0) throw new Error("students.csv is missing status or mb_role_2026");
  return rows.filter((r) => r[status] === "active" && (r[role] || "").trim()).length;
}

const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const round5 = (n) => money(Math.round(n / 5) * 5);
// {{marchers}}, {{marchers*500}}, {{marchers*5}}, {{per:42000}} (that total split per marcher, to $5)
export function fillCounts(markdown, counts) {
  return markdown.replace(/\{\{(marchers(?:\*(\d+))?|per:(\d+))\}\}/g, (_, _all, times, total) => {
    if (total) return round5(Number(total) / counts.marchers2026);
    if (times) return times === "500" ? money(counts.marchers2026 * 500) : String(counts.marchers2026 * Number(times));
    return String(counts.marchers2026);
  });
}
