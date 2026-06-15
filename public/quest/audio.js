/* Theory Quest — chiptune audio. Web Audio oscillators only; no asset files.
   Same engine drives both the SFX and the ear-training note playback. */
(function () {
  let ctx = null;
  const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());

  function tone(f, dur, type, vol, when) {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    const t = c.currentTime + (when || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function seq(notes, type, vol) {
    let t = 0;
    notes.forEach((n) => { tone(n.f, n.d, type, vol, t); t += n.d; });
  }

  window.Sound = {
    unlock() { try { ac().resume(); } catch (e) {} },
    // ear-training: a clean-ish triangle "instrument" note
    note(letter, octave, dur = 0.85) { tone(Music.freq(letter, octave), dur, 'triangle', 0.22); },
    freqTone(f, dur = 0.85) { tone(f, dur, 'triangle', 0.22); },
    correct() { seq([{ f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.16 }], 'square', 0.16); },
    wrong() { seq([{ f: 196, d: 0.12 }, { f: 147, d: 0.2 }], 'sawtooth', 0.16); },
    click() { tone(523, 0.05, 'square', 0.1); },
    levelup() { seq([{ f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.1 }, { f: 1046, d: 0.26 }], 'square', 0.16); },
    fail() { seq([{ f: 330, d: 0.14 }, { f: 247, d: 0.14 }, { f: 165, d: 0.3 }], 'sawtooth', 0.16); },
    startMusic, stopMusic, toggleMusic,
    musicOn: () => musicOn,
  };

  /* ---- looping background chiptune (town theme) ---- */
  let musicOn = false, musicTimer = null;
  const beat = 0.5; // 120 bpm
  const MEL = [659, 0, 784, 0, 659, 587, 523, 0];     // gentle major line, 0 = rest
  const BASS = [131, 165, 196, 165];                  // C3 E3 G3 E3
  function bar() {
    if (!musicOn) return;
    for (let s = 0; s < 8; s++) {
      const w = s * beat;
      if (MEL[s]) tone(MEL[s], beat * 0.8, 'triangle', 0.05, w);
      if (s % 2 === 0) tone(BASS[s / 2], beat * 1.6, 'square', 0.04, w);
    }
    musicTimer = setTimeout(bar, beat * 8 * 1000);
  }
  function startMusic() { if (musicOn) return; ac().resume(); musicOn = true; bar(); }
  function stopMusic() { musicOn = false; clearTimeout(musicTimer); }
  function toggleMusic() { if (musicOn) stopMusic(); else startMusic(); return musicOn; }
})();
