// Holiday trio picker (#255). Temporary and unlisted: students scan a QR code in class, pick
// their instrument, read a trio and save the piece and part they want. Every instrument book has
// all three parts in score on the same pages, so any three instruments can play a piece together.
// The page images live in the private "trio-music" storage bucket (never in this repo) and load
// through short-lived signed links. Remove the route, the bucket and the trio_picks rows at takedown.

export const TRIOS_SLUG = "holiday-trios-718sn8";
export const TRIOS_BUCKET = "trio-music";
export const PAGE_COUNT = 22;

// Folder in the bucket for each instrument book.
export const BOOKS = {
  c: "C instruments",
  "bb-clarinet": "B-flat clarinet",
  "bb-trumpet": "B-flat trumpet",
  "bb-tenor": "B-flat tenor saxophone",
  eb: "E-flat saxophone",
  f: "F horn",
  bass: "Bass clef"
};

export const INSTRUMENTS = [
  { id: "flute", label: "Flute", book: "c" },
  { id: "oboe", label: "Oboe", book: "c" },
  { id: "mallets", label: "Mallets", book: "c" },
  { id: "clarinet", label: "Clarinet", book: "bb-clarinet" },
  { id: "bass-clarinet", label: "Bass Clarinet", book: "bb-clarinet" },
  { id: "alto-sax", label: "Alto Sax", book: "eb" },
  { id: "tenor-sax", label: "Tenor Sax", book: "bb-tenor" },
  { id: "bari-sax", label: "Bari Sax", book: "eb" },
  { id: "trumpet", label: "Trumpet", book: "bb-trumpet" },
  { id: "horn", label: "French Horn", book: "f" },
  { id: "trombone", label: "Trombone", book: "bass" },
  { id: "euphonium", label: "Euphonium", book: "bass" },
  { id: "euphonium-tc", label: "Euphonium (treble clef)", book: "bb-trumpet" },
  { id: "bassoon", label: "Bassoon", book: "bass" },
  { id: "tuba", label: "Tuba", book: "bass" }
];

// pages are scan pages (1-22); the printed book page number is two higher.
export const PIECES = [
  { id: "watts-cradle-song", title: "Watt's Cradle Song", origin: "American folk tune", pages: [1] },
  { id: "cherry-tree-carol", title: "The Cherry Tree Carol", origin: "England", pages: [1] },
  { id: "moon-shines-bright", title: "The Moon Shines Bright", origin: "England", pages: [2] },
  { id: "first-nowell", title: "The First Nowell", origin: "France and England", pages: [2, 3] },
  { id: "remember-o-thou-man", title: "Remember, O Thou Man", origin: "England", pages: [4] },
  { id: "we-three-kings", title: "We Three Kings", pages: [5] },
  { id: "away-in-a-manger", title: "Away in a Manger", pages: [6] },
  { id: "wassail-song", title: "Wassail Song", pages: [7] },
  { id: "when-christ-was-born", title: "When Christ Was Born on Earth", pages: [8] },
  { id: "golden-carol", title: "The Golden Carol", pages: [9] },
  { id: "pastores-a-belen", title: "Pastores a Belén", pages: [10, 11] },
  { id: "joy-to-the-world", title: "Joy to the World", pages: [12] },
  { id: "babe-of-bethlehem", title: "Babe of Bethlehem", pages: [13] },
  { id: "rise-up-shepherd", title: "Rise Up, Shepherd, and Follow", pages: [14] },
  { id: "heavn-bell-a-ring", title: "Heav'n Bell a-Ring", pages: [15] },
  { id: "three-kings", title: "The Three Kings", pages: [16, 17] },
  { id: "chanukah-song", title: "Chanukah Song", pages: [18, 19] },
  { id: "ding-dong-merrily", title: "Ding Dong! Merrily on High", pages: [20, 21] },
  { id: "coventry-carol", title: "Coventry Carol", pages: [22] }
];

export const PERIODS = [
  { id: "1", label: "1st period" },
  { id: "2", label: "2nd period" },
  { id: "4", label: "4th period" }
];

export const PARTS = [1, 2, 3];

export function instrumentById(id) {
  return INSTRUMENTS.find((instrument) => instrument.id === id) || null;
}

export function pieceById(id) {
  return PIECES.find((piece) => piece.id === id) || null;
}

// First name and last initial only, e.g. "Jordan S." Returns "" when it cannot be made safe.
export function cleanStudentName(value) {
  const text = String(value || "").normalize("NFKC").replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const words = text.split(" ").filter(Boolean);
  const first = words[0].replace(/\.+$/, "").slice(0, 20);
  const last = words.length > 1 ? words[words.length - 1].replace(/[^\p{L}]/gu, "").charAt(0) : "";
  if (!first) return "";
  const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);
  return last ? `${cap(first)} ${last.toUpperCase()}.` : cap(first);
}

export function validatePick(input) {
  const period = PERIODS.find((p) => p.id === String(input?.period || ""));
  const instrument = instrumentById(input?.instrument);
  const piece = pieceById(input?.piece);
  const part = Number(input?.part);
  const name = cleanStudentName(input?.name);
  if (!period) return { error: "Choose your class period." };
  if (!instrument) return { error: "Choose your instrument." };
  if (!piece) return { error: "Choose a piece." };
  if (!PARTS.includes(part)) return { error: "Choose part 1, 2 or 3." };
  if (!name || !/ [A-Z]\.$/.test(name)) return { error: "Type your first name and last initial." };
  return { pick: { period: period.id, instrument: instrument.id, piece: piece.id, part, name } };
}
