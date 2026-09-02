export const BERNSTEIN_PIECE_KEY = "a-bernstein-tribute";

export const BERNSTEIN_REHEARSAL_STARTS = Object.freeze([
  1, 8, 15, 25, 33, 41, 46, 55, 63, 66, 73, 78, 88, 92, 98, 106, 112, 120,
  128, 135, 144, 148, 152, 158, 163, 171, 183, 189, 195, 201, 211, 217, 222,
  227, 233, 243, 253, 261, 268, 276, 284, 292, 296, 302,
]);

export const BERNSTEIN_LAST_MEASURE = 312;
export const BERNSTEIN_LARGE_CHANGES = Object.freeze([46, 63, 78, 106, 144, 163]);
export const PRACTICE_STATUSES = Object.freeze(["red", "yellow", "green"]);

export const INSTRUMENTS = Object.freeze([
  "Flute",
  "Oboe",
  "Bassoon",
  "Clarinet",
  "Bass Clarinet",
  "Alto Saxophone",
  "Tenor Saxophone",
  "Baritone Saxophone",
  "Trumpet",
  "Horn",
  "Trombone",
  "Euphonium",
  "Tuba",
  "String Bass",
  "Percussion",
  "Other",
]);

const START_SET = new Set(BERNSTEIN_REHEARSAL_STARTS.map(String));
const STATUS_SET = new Set(PRACTICE_STATUSES);
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePracticeDisplayName(value) {
  const displayName = String(value || "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) throw new Error("Enter a student name.");
  return displayName;
}

export function bernsteinRanges() {
  return BERNSTEIN_REHEARSAL_STARTS.map((start, index) => ({
    start,
    end: BERNSTEIN_REHEARSAL_STARTS[index + 1] - 1 || BERNSTEIN_LAST_MEASURE,
    largeChange: BERNSTEIN_LARGE_CHANGES.includes(start),
  }));
}

export function aggregatePracticeRanges(submissions = []) {
  return bernsteinRanges().map((range) => {
    const counts = { red: 0, yellow: 0, green: 0, unmarked: 0 };
    for (const submission of submissions) {
      const status = submission?.marks?.[range.start];
      if (STATUS_SET.has(status)) counts[status] += 1;
      else counts.unmarked += 1;
    }
    const responseCount = counts.red + counts.yellow + counts.green;
    const concernPercent = responseCount
      ? Math.round(((counts.red * 2 + counts.yellow) / (responseCount * 2)) * 100)
      : null;
    return { ...range, ...counts, responseCount, concernPercent };
  });
}

export function rankPracticeRanges(aggregates = []) {
  return [...aggregates].sort((a, b) => {
    if (a.concernPercent == null && b.concernPercent != null) return 1;
    if (a.concernPercent != null && b.concernPercent == null) return -1;
    return (b.concernPercent ?? -1) - (a.concernPercent ?? -1)
      || b.red - a.red
      || b.yellow - a.yellow
      || b.responseCount - a.responseCount
      || a.start - b.start;
  });
}

export function normalizePracticeSubmission(value) {
  const participantToken = String(value?.participantToken || "").trim();
  const instrument = String(value?.instrument || "").trim();
  const rawMarks = value?.marks && typeof value.marks === "object" && !Array.isArray(value.marks)
    ? value.marks
    : {};

  if (!TOKEN_PATTERN.test(participantToken)) throw new Error("This browser needs a new practice key.");
  const displayName = normalizePracticeDisplayName(value?.displayName);
  if (!INSTRUMENTS.includes(instrument)) throw new Error("Choose your instrument.");

  const marks = {};
  for (const [start, status] of Object.entries(rawMarks)) {
    if (!START_SET.has(start) || !STATUS_SET.has(status)) continue;
    marks[start] = status;
  }

  return { participantToken, displayName, instrument, marks };
}
