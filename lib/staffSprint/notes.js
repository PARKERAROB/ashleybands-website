// Staff Sprint note pools per mode. Each note: { keys: ['c/4'], letter: 'C', clef: 'treble' }
// VexFlow uses lowercase pitch + octave, e.g. 'c/4'. Letter is the answer.

const TREBLE_BEGINNER = [
  { keys: ["e/4"], letter: "E", clef: "treble" },
  { keys: ["f/4"], letter: "F", clef: "treble" },
  { keys: ["g/4"], letter: "G", clef: "treble" },
  { keys: ["a/4"], letter: "A", clef: "treble" },
  { keys: ["b/4"], letter: "B", clef: "treble" },
  { keys: ["c/5"], letter: "C", clef: "treble" },
  { keys: ["d/5"], letter: "D", clef: "treble" },
  { keys: ["e/5"], letter: "E", clef: "treble" },
  { keys: ["f/5"], letter: "F", clef: "treble" }
];

const BASS_BEGINNER = [
  { keys: ["g/2"], letter: "G", clef: "bass" },
  { keys: ["a/2"], letter: "A", clef: "bass" },
  { keys: ["b/2"], letter: "B", clef: "bass" },
  { keys: ["c/3"], letter: "C", clef: "bass" },
  { keys: ["d/3"], letter: "D", clef: "bass" },
  { keys: ["e/3"], letter: "E", clef: "bass" },
  { keys: ["f/3"], letter: "F", clef: "bass" },
  { keys: ["g/3"], letter: "G", clef: "bass" },
  { keys: ["a/3"], letter: "A", clef: "bass" }
];

const POOLS = {
  treble_beginner: TREBLE_BEGINNER,
  bass_beginner: BASS_BEGINNER,
  mixed_beginner: [...TREBLE_BEGINNER, ...BASS_BEGINNER]
};

export const MODES = [
  { value: "treble_beginner", label: "Treble Beginner (E4–F5)" },
  { value: "bass_beginner", label: "Bass Beginner (G2–A3)" },
  { value: "mixed_beginner", label: "Mixed (Treble + Bass)" }
];

export const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

export function pickNote(mode, lastKey) {
  const pool = POOLS[mode] || POOLS.mixed_beginner;
  if (pool.length === 1) return pool[0];
  let next;
  let tries = 0;
  do {
    next = pool[Math.floor(Math.random() * pool.length)];
    tries++;
  } while (next.keys[0] === lastKey && tries < 5);
  return next;
}
