/* Theory Quest — curriculum data spine.
   Source of sequence: Alfred's Essentials of Music Theory, Books 1-3
   (3 books / 18 units / 75 lessons). This file is the ONLY thing that grows
   as we add zones — the engine (game.js) stays fixed.

   A zone is "built" when it has `lessons`. Stub zones (just name + unit) render
   on the world map as locked, so the full campaign is visible from day one. */

const N = (letter, octave) => ({ letter, octave });

// note pools the encounter generator draws from
const POOLS = {
  trebleStaff: [N('E', 4), N('F', 4), N('G', 4), N('A', 4), N('B', 4), N('C', 5), N('D', 5), N('E', 5), N('F', 5)],
  bassStaff:   [N('G', 2), N('A', 2), N('B', 2), N('C', 3), N('D', 3), N('E', 3), N('F', 3), N('G', 3), N('A', 3)],
  trebleLow:   [N('C', 4), N('D', 4), N('B', 3), N('A', 3)],   // around middle C, treble side
  bassHigh:    [N('C', 4), N('B', 3), N('A', 3), N('D', 4)],   // around middle C, bass side
  trebleLedgerHi: [N('A', 5), N('B', 5), N('C', 6), N('G', 5)],
  bassLedgerLo:   [N('F', 2), N('E', 2), N('D', 2), N('C', 2)],
  earWide:     [N('C', 3), N('G', 3), N('C', 4), N('E', 4), N('G', 4), N('C', 5), N('E', 5), N('G', 5), N('C', 6)],
  earLow:      [N('C', 3), N('E', 3), N('G', 3), N('A', 3)],
  earHigh:     [N('C', 5), N('E', 5), N('G', 5), N('C', 6)],
};

const CURRICULUM = {
  title: 'THEORY QUEST',
  source: "Alfred's Essentials of Music Theory",
  zones: [
    /* ================= ZONE 1 — BUILT (the vertical slice) ================= */
    {
      id: 1, book: 1, unit: 1, name: 'The Staff',
      blurb: 'Every musical journey begins here. Learn the lines, the spaces, and the two clefs that hold all of music.',
      loot: ['Treble Clef', 'Bass Clef', 'Grand Staff', 'Ledger Line', "Reader's Eye"],
      lessons: [
        {
          id: 1, title: 'Notes & Pitches',
          teach: 'Music lives on a <b>STAFF</b>: 5 lines and 4 spaces. The higher a note sits, the higher it sounds. Train your ear first — up or down?',
          encounters: [
            { kind: 'earRegister', count: 2 },
            { kind: 'earHighLow', count: 4 },
          ],
        },
        {
          id: 2, title: 'Treble Clef',
          teach: 'The <b>treble clef</b> curls around the G line. Lines, bottom to top: <b>E G B D F</b> — "Every Good Boy Does Fine". Spaces spell <b>F A C E</b>.',
          encounters: [{ kind: 'noteId', clef: 'treble', pool: 'trebleStaff', count: 6 }],
        },
        {
          id: 3, title: 'Bass Clef',
          teach: 'The <b>bass clef</b> marks the F line with its two dots. Lines: <b>G B D F A</b> — "Good Boys Do Fine Always". Spaces: <b>A C E G</b> — "All Cows Eat Grass".',
          encounters: [{ kind: 'noteId', clef: 'bass', pool: 'bassStaff', count: 6 }],
        },
        {
          id: 4, title: 'Grand Staff & Middle C',
          teach: 'Treble + bass joined = the <b>GRAND STAFF</b>. <b>Middle C</b> floats between them on its own short <b>ledger line</b>. Read carefully near the middle.',
          encounters: [
            { kind: 'noteId', clef: 'treble', pool: 'trebleLow', count: 3 },
            { kind: 'noteId', clef: 'bass', pool: 'bassHigh', count: 3 },
            { kind: 'placeNote', clef: 'treble', target: N('C', 4), count: 1 },
          ],
        },
        {
          id: 5, title: 'Ledger Lines: High & Low',
          teach: 'Notes can climb above or dive below the staff on <b>ledger lines</b> — one line per step. Count from the edge of the staff outward.',
          encounters: [
            { kind: 'noteId', clef: 'treble', pool: 'trebleLedgerHi', count: 3 },
            { kind: 'noteId', clef: 'bass', pool: 'bassLedgerLo', count: 3 },
          ],
        },
      ],
      miniBoss: {
        title: "The Tuner's Trial",
        teach: 'Trust your ears. No staff to read — just listen and judge the pitch.',
        encounters: [
          { kind: 'earHighLow', count: 4 },
          { kind: 'earRegister', count: 3 },
        ],
      },
      boss: {
        title: 'Guardian of the Staff',
        teach: 'Prove you can read every note. Clear the Guardian to open Zone 2.',
        encounters: [
          { kind: 'noteId', clef: 'treble', pool: 'trebleStaff', count: 4 },
          { kind: 'noteId', clef: 'bass', pool: 'bassStaff', count: 4 },
          { kind: 'noteId', clef: 'treble', pool: 'trebleLedgerHi', count: 2 },
          { kind: 'placeNote', clef: 'bass', target: N('C', 4), count: 1 },
          { kind: 'earHighLow', count: 2 },
        ],
      },
    },

    /* ================= ZONES 2-18 — STUBS (locked on the map) ============== */
    { id: 2,  book: 1, unit: 2,  name: 'Note Values',            blurb: 'Whole, half, quarter notes and rests. The measure and the bar line.' },
    { id: 3,  book: 1, unit: 3,  name: 'Time Signatures',        blurb: '3/4 and 2/4 time, dotted half notes, ties and slurs.' },
    { id: 4,  book: 1, unit: 4,  name: 'Eighth Notes & Repeats', blurb: 'Eighth notes and rests, dotted quarters, repeat signs and endings.' },
    { id: 5,  book: 1, unit: 5,  name: 'Expression',             blurb: 'Dynamics, tempo marks, articulation, D.C./D.S./Coda/Fine.' },
    { id: 6,  book: 1, unit: 6,  name: 'Sharps, Flats & Steps',  blurb: 'Flats, sharps, naturals, whole steps, half steps, enharmonics.' },

    { id: 7,  book: 2, unit: 7,  name: 'Major Scales & Keys',    blurb: 'Tetrachords, major scales, sharp and flat key signatures.' },
    { id: 8,  book: 2, unit: 8,  name: 'Circle of Fifths',       blurb: 'All major scales, the chromatic scale, intervals, the circle of fifths.' },
    { id: 9,  book: 2, unit: 9,  name: 'Interval Quality',       blurb: 'Perfect, major, minor, augmented, diminished. Solfège & transposition.' },
    { id: 10, book: 2, unit: 10, name: 'Sixteenths & Cut Time',  blurb: 'Sixteenth notes and rests, dotted eighths, common and cut time.' },
    { id: 11, book: 2, unit: 11, name: 'Compound Meter',         blurb: '6/8 and 3/8 time, triplets, pick-up notes, syncopation.' },
    { id: 12, book: 2, unit: 12, name: 'Triads & the V7',        blurb: 'Building triads, scale degree names, the dominant 7th chord.' },

    { id: 13, book: 3, unit: 13, name: 'Inversions',             blurb: 'Triad and V7 inversions, figured bass, chord progressions.' },
    { id: 14, book: 3, unit: 14, name: 'Minor Scales',           blurb: 'Natural, harmonic, melodic minor; minor, augmented, diminished triads.' },
    { id: 15, book: 3, unit: 15, name: 'Modes',                  blurb: 'Primary triads in minor, minor progressions, the seven modes.' },
    { id: 16, book: 3, unit: 16, name: 'Harmonizing (Major)',    blurb: 'Harmonize and compose a melody; broken chords, passing tones.' },
    { id: 17, book: 3, unit: 17, name: 'Minor Harmony & Blues',  blurb: 'Harmonize in minor, the 12-bar blues, the blues scale.' },
    { id: 18, book: 3, unit: 18, name: 'Musical Form',           blurb: 'Motive and phrase, binary, ternary, and rondo form.' },
  ],
};

window.POOLS = POOLS;
window.CURRICULUM = CURRICULUM;
