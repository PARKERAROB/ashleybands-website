import crypto from "node:crypto";

export const IC_ATTENDANCE_PARSER_VERSION = "attendance-register-fop-2";
export const IC_ATTENDANCE_CODES = Object.freeze({
  T: "Tardy",
  A: "Absent excused",
  U: "Absent unexcused",
  "?": "Absent unknown",
  X: "Absent exempt",
  "-": "Student off roll"
});

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 60;
const DATE_ITEM = /^(?:[A-Z][a-z]{2}|\d{2})$/;
const STUDENT_NUMBER = /^\d{7,12}$/;
const SECTION_HEADING = /^(\d+)\)\s+([0-9A-Z]+-\d+)\s+(.+)$/;

function isoDate(month, day, year) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateRange(items) {
  for (const item of items) {
    const match = item.str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+-\s+(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      return {
        start: isoDate(match[1], match[2], match[3]),
        end: isoDate(match[4], match[5], match[6])
      };
    }
  }
  throw new Error("Attendance Register date range was not found.");
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pageItems(textContent) {
  return textContent.items
    .map((item) => ({
      str: String(item.str || "").trim(),
      x: Number(item.transform?.[4] || 0),
      y: Number(item.transform?.[5] || 0),
      width: Number(item.width || 0),
      height: Number(item.height || 0)
    }))
    .filter((item) => item.str);
}

function nearestColumn(centers, item) {
  const center = item.x + item.width / 2;
  let selected = -1;
  let distance = Infinity;
  for (let index = 0; index < centers.length; index += 1) {
    const nextDistance = Math.abs(center - centers[index]);
    if (nextDistance < distance) {
      selected = index;
      distance = nextDistance;
    }
  }
  return distance <= 8 ? selected : -1;
}

function parseGenerated(items) {
  const generated = items.find((item) => /^Generated on /i.test(item.str))?.str || "";
  const match = generated.match(/^Generated on (\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2}:\d{2}) ([AP]M)$/i);
  if (!match) throw new Error("Attendance Register generated time was not found.");
  const [, localDate, localTime, meridiem] = match;
  const [month, day, year] = localDate.split("/").map(Number);
  const [rawHour, minute, second] = localTime.split(":").map(Number);
  const hour = rawHour % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0);
  const localIsoDate = isoDate(month, day, year);
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset"
  }).formatToParts(new Date(`${localIsoDate}T12:00:00.000Z`))
    .find((part) => part.type === "timeZoneName")?.value || "GMT-05:00";
  const offset = offsetName.replace("GMT", "");
  return {
    label: `${localDate} ${localTime} ${meridiem.toUpperCase()}`,
    localDate: localIsoDate,
    iso: `${localIsoDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${offset}`
  };
}

function parsePageCount(items) {
  const value = items.find((item) => /^Page \d+ of \d+$/i.test(item.str))?.str || "";
  const match = value.match(/^Page \d+ of (\d+)$/i);
  if (!match) throw new Error("Attendance Register page count was not found.");
  return Number(match[1]);
}

export function parseAttendanceRegisterPages(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error("Attendance Register has no pages.");
  const first = pages[0];
  if (!first.some((item) => item.str === "Attendance Register")) {
    throw new Error("This PDF is not an Infinite Campus Attendance Register.");
  }
  const period = parseDateRange(first);
  const generated = parseGenerated(first);
  const pageCount = parsePageCount(first);
  if (pageCount !== pages.length) throw new Error("Attendance Register page count does not match the PDF.");
  const schedule = first.find((item) => /^Schedule:\s*/i.test(item.str))?.str.replace(/^Schedule:\s*/i, "").trim() || "";
  const term = first.find((item) => /Terms?$/i.test(item.str))?.str || "";
  const schoolYear = first.find((item) => /^\d{2}-\d{2}\s+/.test(item.str))?.str || "";

  const sectionMap = new Map();
  const studentMap = new Map();
  const marks = [];
  const issues = [];
  const dateMap = new Map();
  const windowDates = new Map();
  const sectionByWindow = new Map();
  let lastWindowEnd = addDays(period.start, -1);

  function weekdayLabel(dateValue) {
    return ["S", "M", "T", "W", "T", "F", "S"][new Date(`${dateValue}T12:00:00.000Z`).getUTCDay()];
  }

  function headerLabelMatches(dateValue, label, column) {
    const date = new Date(`${dateValue}T12:00:00.000Z`);
    if (/^\d{2}$/.test(label)) return Number(label) === date.getUTCDate();
    const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return label === month && (column === 0 || date.getUTCDate() === 1);
  }

  function deriveWindowDates(weekdayLabels, dateLabels) {
    const result = [];
    let cursor = addDays(lastWindowEnd, 1);
    for (let column = 0; column < weekdayLabels.length; column += 1) {
      const targetWeekday = weekdayLabels[column];
      const targetLabel = dateLabels[column];
      let match = null;
      for (let offset = 0; offset < 8; offset += 1) {
        const candidate = addDays(cursor, offset);
        if (weekdayLabel(candidate) === targetWeekday
          && headerLabelMatches(candidate, targetLabel, column)) {
          match = candidate;
          break;
        }
      }
      if (!match) throw new Error("Attendance Register date headers are ambiguous or out of sequence.");
      result.push(match);
      cursor = addDays(match, 1);
    }
    lastWindowEnd = result.at(-1);
    return result;
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const items = pages[pageIndex];
    const studentHeader = items.find((item) => item.str === "Student Name");
    if (!studentHeader) throw new Error(`Attendance Register page ${pageIndex + 1} has no student header.`);
    const headerY = studentHeader.y;
    const weekdayItems = items
      .filter((item) => Math.abs(item.y - headerY) < 1 && item.x > 190 && /^[MTWFS]$/.test(item.str))
      .sort((a, b) => a.x - b.x);
    if (!weekdayItems.length) throw new Error(`Attendance Register page ${pageIndex + 1} has no date columns.`);
    const centers = weekdayItems.map((item) => item.x + item.width / 2);
    const labelItems = items
      .filter((item) => item.x > 190 && item.y > headerY + 5 && item.y < headerY + 20 && DATE_ITEM.test(item.str))
      .sort((a, b) => a.x - b.x);
    const labels = centers.map((center) => {
      const candidates = labelItems
        .map((item) => ({ item, distance: Math.abs(item.x + item.width / 2 - center) }))
        .sort((a, b) => a.distance - b.distance);
      if (!candidates[0] || candidates[0].distance > 8) {
        throw new Error(`Attendance Register page ${pageIndex + 1} has an incomplete date header.`);
      }
      return candidates[0].item.str;
    });
    const weekdayLabels = weekdayItems.map((item) => item.str);
    const signature = `${centers.length}:${weekdayLabels.join("")}:${labels.join("|")}`;
    if (!windowDates.has(signature)) {
      windowDates.set(signature, deriveWindowDates(weekdayLabels, labels));
    }
    const datesForWindow = windowDates.get(signature);
    for (let column = 0; column < centers.length; column += 1) {
      const attendanceDate = datesForWindow[column];
      if (attendanceDate <= period.end) {
        dateMap.set(attendanceDate, { attendanceDate, sourceColumn: column + 1 });
      }
    }

    let currentSection = sectionByWindow.get(signature) || null;
    const rowItems = items
      .filter((item) => item.y < headerY - 2 && item.x < 195)
      .sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of rowItems) {
      const sectionMatch = item.str.match(SECTION_HEADING);
      if (sectionMatch && item.x < 60) {
        currentSection = {
          sequence: Number(sectionMatch[1]),
          sourceSectionCode: sectionMatch[2],
          name: sectionMatch[3].trim()
        };
        sectionMap.set(currentSection.sourceSectionCode, currentSection);
        sectionByWindow.set(signature, currentSection);
        continue;
      }
      if (!STUDENT_NUMBER.test(item.str) || item.x >= 80) continue;
      const nameItem = items.find((candidate) =>
        Math.abs(candidate.y - item.y) < 1 && candidate.x >= 90 && candidate.x < 195);
      if (!currentSection || !nameItem) {
        issues.push({
          kind: "unresolved_row",
          page: pageIndex + 1,
          detail: "A student row could not be connected to a class section and name."
        });
        continue;
      }
      const studentKey = `${currentSection.sourceSectionCode}:${item.str}`;
      if (!studentMap.has(studentKey)) {
        studentMap.set(studentKey, {
          sourceStudentNumber: item.str,
          sourceStudentName: nameItem.str,
          sourceSectionCode: currentSection.sourceSectionCode,
          sourcePage: pageIndex + 1
        });
      }
      const cells = items.filter((candidate) =>
        Math.abs(candidate.y - item.y) < 1 && candidate.x > 195 && candidate.str.length === 1);
      for (const cell of cells) {
        const column = nearestColumn(centers, cell);
        if (column < 0) continue;
        const attendanceDate = datesForWindow[column];
        if (attendanceDate > period.end) continue;
        if (!Object.hasOwn(IC_ATTENDANCE_CODES, cell.str)) {
          issues.push({
            kind: "unknown_code",
            page: pageIndex + 1,
            sectionCode: currentSection.sourceSectionCode,
            attendanceDate,
            code: cell.str,
            detail: "An attendance code is not in the supported Infinite Campus legend."
          });
          continue;
        }
        marks.push({
          sourceStudentNumber: item.str,
          sourceSectionCode: currentSection.sourceSectionCode,
          attendanceDate,
          code: cell.str,
          meaning: IC_ATTENDANCE_CODES[cell.str],
          sourcePage: pageIndex + 1,
          sourceColumn: column + 1
        });
      }
    }
  }

  const latestExplicitMarkDate = marks.reduce((latest, mark) =>
    !latest || mark.attendanceDate > latest ? mark.attendanceDate : latest, "");
  const coverageLimit = [period.end, addDays(generated.localDate, -1)].sort()[0];
  const throughDate = [...dateMap.keys()]
    .filter((dateValue) => dateValue <= coverageLimit)
    .filter((dateValue) => {
      const weekday = new Date(`${dateValue}T12:00:00.000Z`).getUTCDay();
      return weekday !== 0 && weekday !== 6;
    })
    .sort()
    .at(-1) || null;
  return {
    parserVersion: IC_ATTENDANCE_PARSER_VERSION,
    generatedLocal: generated.label,
    generatedAt: generated.iso,
    periodStart: period.start,
    periodEnd: period.end,
    throughDate,
    latestExplicitMarkDate: latestExplicitMarkDate || null,
    term,
    schedule,
    schoolYear,
    pageCount,
    sections: [...sectionMap.values()].sort((a, b) => a.sequence - b.sequence),
    students: [...studentMap.values()].sort((a, b) =>
      a.sourceSectionCode.localeCompare(b.sourceSectionCode)
      || a.sourceStudentName.localeCompare(b.sourceStudentName)),
    dates: [...dateMap.values()].sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate)),
    marks: marks.sort((a, b) =>
      a.attendanceDate.localeCompare(b.attendanceDate)
      || a.sourceSectionCode.localeCompare(b.sourceSectionCode)
      || a.sourceStudentNumber.localeCompare(b.sourceStudentNumber)),
    issues
  };
}

export async function parseAttendanceRegisterPdf(input) {
  const bytes = Uint8Array.from(input instanceof Uint8Array ? input : new Uint8Array(input));
  if (bytes.byteLength < 5 || bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error("Attendance Register PDF must be between 5 bytes and 8 MB.");
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("Choose the PDF generated by Infinite Campus.");
  }
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: bytes, disableWorker: true }).promise;
  if (document.numPages > MAX_PAGES) throw new Error("Attendance Register has too many pages.");
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    pages.push(pageItems(await page.getTextContent()));
  }
  return parseAttendanceRegisterPages(pages);
}

export function attendanceRegisterFileHash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function protectedStudentIdentifier(value, secret) {
  const normalized = String(value || "").replace(/\D/g, "");
  if (!normalized || !secret) throw new Error("Protected student identifier cannot be created.");
  return {
    hash: crypto.createHmac("sha256", secret).update(`nhcs_sis_student_number:${normalized}`).digest("hex"),
    last4: normalized.slice(-4)
  };
}
