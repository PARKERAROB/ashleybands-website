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

export function bernsteinRanges() {
  return BERNSTEIN_REHEARSAL_STARTS.map((start, index) => ({
    start,
    end: BERNSTEIN_REHEARSAL_STARTS[index + 1] - 1 || BERNSTEIN_LAST_MEASURE,
    largeChange: BERNSTEIN_LARGE_CHANGES.includes(start),
  }));
}

export function normalizePracticeSubmission(value) {
  const participantToken = String(value?.participantToken || "").trim();
  const displayName = String(value?.displayName || "").trim().replace(/\s+/g, " ");
  const instrument = String(value?.instrument || "").trim();
  const rawMarks = value?.marks && typeof value.marks === "object" && !Array.isArray(value.marks)
    ? value.marks
    : {};

  if (!TOKEN_PATTERN.test(participantToken)) throw new Error("This browser needs a new practice key.");
  if (displayName.length < 2 || displayName.length > 80) throw new Error("Enter your name.");
  if (!INSTRUMENTS.includes(instrument)) throw new Error("Choose your instrument.");

  const marks = {};
  for (const [start, status] of Object.entries(rawMarks)) {
    if (!START_SET.has(start) || !STATUS_SET.has(status)) continue;
    marks[start] = status;
  }

  return { participantToken, displayName, instrument, marks };
}
