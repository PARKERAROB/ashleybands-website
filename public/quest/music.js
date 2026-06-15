/* Theory Quest — music engine: note math + staff rendering.
   Pure, no game state. Everything keyed off a "diatonic step":
   step = octave*7 + letterIndex (C=0..B=6). One step = one line-or-space. */
(function () {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }; // semitone within octave

  const dstep = (l, o) => o * 7 + LETTERS.indexOf(l);
  const midi = (l, o, a = 0) => (o + 1) * 12 + PC[l] + a;
  const freq = (l, o, a = 0) => 440 * Math.pow(2, (midi(l, o, a) - 69) / 12);
  const stepLetter = (s) => LETTERS[((s % 7) + 7) % 7];
  const stepOctave = (s) => Math.floor(s / 7);
  const onLine = (clef, l, o) => (dstep(l, o) - CLEF[clef].bottom) % 2 === 0;

  // Each clef: which diatonic step sits on its bottom staff line, + its glyph.
  const CLEF = {
    treble: { bottom: dstep('E', 4), glyph: '𝄞' }, // U+1D11E
    bass:   { bottom: dstep('G', 2), glyph: '𝄢' }, // U+1D122
  };

  // geometry
  const GAP = 12;            // px between adjacent staff lines
  const X0 = 56;             // left edge of staff lines
  const W = 320, H = 184;
  const LINE_W = W - X0 - 18;
  const Y_BOTTOM = 118;      // y of the bottom staff line

  const yOf = (clef, step) => Y_BOTTOM - (step - CLEF[clef].bottom) * (GAP / 2);
  const ledger = (cx, ly) => `<line x1="${cx - 14}" y1="${ly}" x2="${cx + 14}" y2="${ly}" class="ledger"/>`;
  const clefText = (clef) =>
    `<text x="${X0 - 44}" y="${clef === 'treble' ? Y_BOTTOM + 8 : Y_BOTTOM - 12}" class="clef">${CLEF[clef].glyph}</text>`;

  // a single notehead (with stem, ledger lines, optional letter label) at x=cx
  function headAt(clef, note, cx, label) {
    const step = dstep(note.letter, note.octave);
    const b = CLEF[clef].bottom, top = b + 8;
    const y = yOf(clef, step);
    let g = '';
    if (step > top) for (let L = top + 2; L <= step; L += 2) g += ledger(cx, yOf(clef, L));
    if (step < b) for (let L = b - 2; L >= step; L -= 2) g += ledger(cx, yOf(clef, L));
    const up = step < b + 4;
    const sx = up ? cx + 8.5 : cx - 8.5;
    const sy2 = up ? y - 36 : y + 36;
    g += `<line x1="${sx}" y1="${y}" x2="${sx}" y2="${sy2}" class="stem"/>`;
    g += `<ellipse cx="${cx}" cy="${y}" rx="9.5" ry="6.8" class="head" transform="rotate(-18 ${cx} ${y})"/>`;
    if (label) {
      const ly = Math.min(y, yOf(clef, top)) - 18;
      g += `<text x="${cx}" y="${ly}" class="notelabel" text-anchor="middle">${note.letter}</text>`;
    }
    return g;
  }

  function staffOpen(clef) {
    let s = `<svg viewBox="0 0 ${W} ${H}" class="staff" preserveAspectRatio="xMidYMid meet" role="img">`;
    s += `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="6" class="staffbg"/>`;
    for (let i = 0; i < 5; i++) {
      const y = yOf(clef, CLEF[clef].bottom + i * 2);
      s += `<line x1="${X0}" y1="${y}" x2="${X0 + LINE_W}" y2="${y}" class="sl"/>`;
    }
    return s + clefText(clef);
  }

  /* one staff, one optional note.
     opts.label draws the letter; opts.click adds tap-bands; opts.showNote=false hides note. */
  function staffSVG(clef, note, opts) {
    opts = opts || {};
    let s = staffOpen(clef);
    if (opts.click) {
      const lo = CLEF[clef].bottom - 6, hi = CLEF[clef].bottom + 8 + 6;
      for (let st = lo; st <= hi; st++) {
        const y = yOf(clef, st);
        s += `<rect class="hit" data-step="${st}" x="${X0}" y="${(y - GAP / 4).toFixed(1)}" width="${LINE_W}" height="${GAP / 2}"/>`;
      }
    }
    if (note && opts.showNote !== false) s += headAt(clef, note, X0 + LINE_W * 0.6, opts.label);
    return s + `</svg>`;
  }

  /* one staff, several notes spread across it — for teaching cards
     ("the lines spell E G B D F"). opts.label shows each letter. */
  function staffMulti(clef, notes, opts) {
    opts = opts || {};
    let s = staffOpen(clef);
    const x0 = X0 + 34, x1 = X0 + LINE_W - 16, n = notes.length;
    notes.forEach((nt, i) => {
      const cx = n > 1 ? x0 + (x1 - x0) * (i / (n - 1)) : (x0 + x1) / 2;
      s += headAt(clef, nt, cx, opts.label);
    });
    return s + `</svg>`;
  }

  window.Music = { LETTERS, PC, dstep, midi, freq, stepLetter, stepOctave, onLine, staffSVG, staffMulti, CLEF };
})();
