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

const LEGENDS_MOVEMENTS = Object.freeze([
  Object.freeze({
    key: "patrick-on-the-railway",
    number: "I",
    title: "Patrick on the Railway",
    rehearsalStarts: Object.freeze([
      1, 7, 13, 21, 29, 38, 46, 53, 59, 67, 75, 79, 87, 92, 100, 108, 116,
      126, 133, 136,
    ]),
    lastMeasure: 145,
    largeChanges: Object.freeze([]),
  }),
  Object.freeze({
    key: "sweet-betsy",
    number: "II",
    title: "Sweet Betsy",
    rehearsalStarts: Object.freeze([
      1, 9, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 112,
    ]),
    lastMeasure: 119,
    largeChanges: Object.freeze([]),
  }),
  Object.freeze({
    key: "little-david-play-on",
    number: "III",
    title: "Little David, Play On!",
    rehearsalStarts: Object.freeze([
      1, 9, 15, 23, 29, 37, 45, 53, 60, 71, 75, 82, 88, 96, 104, 111, 115,
    ]),
    lastMeasure: 119,
    largeChanges: Object.freeze([]),
  }),
]);

export const PRACTICE_PIECES = Object.freeze({
  "bernstein-tribute": Object.freeze({
    slug: "bernstein-tribute",
    key: BERNSTEIN_PIECE_KEY,
    title: "A Bernstein Tribute",
    shortCredit: "Clare Grundman",
    credit: "Leonard Bernstein music adapted for concert band by Clare Grundman",
    storageKey: "ashleybands:practice-loop:a-bernstein-tribute:v1",
    legacyNumericRangeKeys: true,
    movements: Object.freeze([
      Object.freeze({
        key: "full-piece",
        number: "",
        title: "A Bernstein Tribute",
        rehearsalStarts: BERNSTEIN_REHEARSAL_STARTS,
        lastMeasure: BERNSTEIN_LAST_MEASURE,
        largeChanges: BERNSTEIN_LARGE_CHANGES,
      }),
    ]),
  }),
  "legends-and-heroes": Object.freeze({
    slug: "legends-and-heroes",
    key: "legends-and-heroes",
    title: "Legends and Heroes",
    subtitle: "American Folksong Suite No. 1",
    shortCredit: "Pierre La Plante",
    credit: "American Folksong Suite No. 1 by Pierre La Plante",
    storageKey: "ashleybands:practice-loop:legends-and-heroes:v1",
    legacyNumericRangeKeys: false,
    movements: LEGENDS_MOVEMENTS,
  }),
});

export const PRACTICE_PIECE_LIST = Object.freeze(Object.values(PRACTICE_PIECES));
export const DEFAULT_PRACTICE_PIECE_SLUG = "bernstein-tribute";

const STATUS_SET = new Set(PRACTICE_STATUSES);
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getPracticePiece(slug = DEFAULT_PRACTICE_PIECE_SLUG) {
  return PRACTICE_PIECES[String(slug || "").trim()] || null;
}

export function normalizePracticeDisplayName(value) {
  const displayName = String(value || "").trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) throw new Error("Enter a student name.");
  return displayName;
}

export function practiceRanges(pieceOrSlug = DEFAULT_PRACTICE_PIECE_SLUG) {
  const piece = typeof pieceOrSlug === "string" ? getPracticePiece(pieceOrSlug) : pieceOrSlug;
  if (!piece) return [];

  return piece.movements.flatMap((movement, movementIndex) => (
    movement.rehearsalStarts.map((start, rangeIndex) => ({
      id: piece.legacyNumericRangeKeys ? String(start) : `${movement.key}:${start}`,
      movementKey: movement.key,
      movementNumber: movement.number,
      movementTitle: movement.title,
      movementIndex,
      start,
      end: movement.rehearsalStarts[rangeIndex + 1] - 1 || movement.lastMeasure,
      largeChange: movement.largeChanges.includes(start),
    }))
  ));
}

export function bernsteinRanges() {
  return practiceRanges(DEFAULT_PRACTICE_PIECE_SLUG);
}

export function aggregatePracticeRanges(submissions = [], ranges = bernsteinRanges()) {
  return ranges.map((range) => {
    const counts = { red: 0, yellow: 0, green: 0, unmarked: 0 };
    for (const submission of submissions) {
      const status = submission?.marks?.[range.id];
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
      || (a.movementIndex ?? 0) - (b.movementIndex ?? 0)
      || a.start - b.start;
  });
}

export function normalizePracticeSubmission(value, pieceOrSlug = DEFAULT_PRACTICE_PIECE_SLUG) {
  const piece = typeof pieceOrSlug === "string" ? getPracticePiece(pieceOrSlug) : pieceOrSlug;
  if (!piece) throw new Error("Choose a valid practice piece.");

  const participantToken = String(value?.participantToken || "").trim();
  const instrument = String(value?.instrument || "").trim();
  const rawMarks = value?.marks && typeof value.marks === "object" && !Array.isArray(value.marks)
    ? value.marks
    : {};

  if (!TOKEN_PATTERN.test(participantToken)) throw new Error("This browser needs a new practice key.");
  const displayName = normalizePracticeDisplayName(value?.displayName);
  if (!INSTRUMENTS.includes(instrument)) throw new Error("Choose your instrument.");

  const rangeIds = new Set(practiceRanges(piece).map(({ id }) => id));
  const marks = {};
  for (const [rangeId, status] of Object.entries(rawMarks)) {
    if (!rangeIds.has(rangeId) || !STATUS_SET.has(status)) continue;
    marks[rangeId] = status;
  }

  return { participantToken, displayName, instrument, marks };
}
