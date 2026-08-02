const SCORE_ORDER = [
  "Drum Major",
  "Flute",
  "Clarinet",
  "Bass Clarinet",
  "Alto Sax",
  "Tenor Sax",
  "Bari Sax",
  "Trumpet",
  "Horn",
  "Trombone",
  "Tuba",
  "Battery Percussion",
  "Front Ensemble",
  "Color Guard",
  "Provisional / placement pending"
];

const SCORE_INDEX = new Map(SCORE_ORDER.map((section, index) => [section, index]));

export function compareMarchingSections(left, right) {
  const leftSection = String(left || "");
  const rightSection = String(right || "");
  const leftIndex = SCORE_INDEX.get(leftSection) ?? SCORE_ORDER.length;
  const rightIndex = SCORE_INDEX.get(rightSection) ?? SCORE_ORDER.length;
  return leftIndex - rightIndex || leftSection.localeCompare(rightSection);
}

export function attendanceSectionForStudent({ role, instrument }) {
  if (role !== "Percussion") return role || "Provisional / placement pending";
  return /\b(snare|bass drum|quads?|tenors?)\b/i.test(String(instrument || ""))
    ? "Battery Percussion"
    : "Front Ensemble";
}
