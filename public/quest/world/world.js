/* Theory Quest: Overworld prototype.
   Hand-rolled tile engine (no game library). Walk a sprite around Theory Town,
   tall grass triggers a wild "Clef-mon" encounter, reading its note captures it,
   repeat captures evolve it, and catching all four opens the Clef Gym for a badge.
   Reuses /quest/music.js (staff render) + audio.js (chiptune). Programmer-art on
   purpose — this proves the FEEL and the loop, not the final polish. */
(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const TILE = 16;
  ctx.imageSmoothingEnabled = false;

  /* ---------------- map -------------------------------------------------- */
  const MAP = [
    'TTTTTTTTTTTTTTT',
    'T.....HHH.....T',
    'T.....HHH.....T',
    'T......D......T',   // D = gym door (interact)
    'T.....PPP.....T',
    'T..S..PPP.....T',   // S = sign
    'T.....PPP.....T',
    'Tgg...PPP...ggT',
    'Tggg..PPP..gggT',
    'Tgggg.PPP.ggggT',
    'Tggggg...gggggT',
    'T......P......T',
    'TTTTTTTTTTTTTTT',
  ];
  const MW = MAP[0].length, MH = MAP.length;
  const tileAt = (x, y) => (y < 0 || x < 0 || y >= MH || x >= MW) ? 'T' : MAP[y][x];
  const BLOCK = { T: 1, H: 1, D: 1, S: 1, F: 1 };
  const walkable = (x, y) => !BLOCK[tileAt(x, y)];

  /* ---------------- save -------------------------------------------------- */
  const KEY = 'theoryQuestWorld_v2';
  const fresh = () => ({ version: 2, dex: [], steps: 0, captures: {}, badges: [] });
  let SAVE = (() => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.version === 2 ? s : fresh(); } catch (e) { return fresh(); } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SAVE)); } catch (e) {} };

  /* ---------------- creatures (concepts as Clef-mon) --------------------- */
  const N = (letter, octave) => ({ letter, octave });
  const MONS = {
    trebbly:    { name: 'TREBBLY', glyph: '𝄞', color: '#ffd23f', clef: 'treble', teaches: 'the Treble Clef',
                  pool: [N('E', 4), N('G', 4), N('B', 4), N('D', 5), N('F', 5), N('F', 4), N('A', 4), N('C', 5), N('E', 5)],
                  evolveAt: 3, evo: { name: 'TREBLION', glyph: '𝄞', color: '#fff07a' } },
    basher:     { name: 'BASHER', glyph: '𝄢', color: '#46e0ff', clef: 'bass', teaches: 'the Bass Clef',
                  pool: [N('G', 2), N('B', 2), N('D', 3), N('F', 3), N('A', 3), N('A', 2), N('C', 3), N('E', 3), N('G', 3)],
                  evolveAt: 3, evo: { name: 'BASSALISK', glyph: '𝄢', color: '#8af1ff' } },
    midda:      { name: 'MIDDA', glyph: '𝅗𝅥', color: '#ff6ad5', clef: 'treble', teaches: 'Middle C',
                  pool: [N('C', 4), N('D', 4), N('B', 3)],
                  evolveAt: 3, evo: { name: 'MIDDANTE', glyph: '𝅗𝅥', color: '#ff9ae3' } },
    ledgerling: { name: 'LEDGERLING', glyph: '𝅘𝅥', color: '#3ddc84', clef: 'treble', teaches: 'Ledger Lines',
                  pool: [N('G', 5), N('A', 5), N('B', 5), N('C', 6)],
                  evolveAt: 3, evo: { name: 'LEDGEERON', glyph: '𝅘𝅥', color: '#74f0aa' } },
  };
  const MONKEYS = Object.keys(MONS);
  // display form (evolves once you've captured it enough)
  function disp(key) {
    const m = MONS[key], c = SAVE.captures[key] || 0;
    return (m.evolveAt && c >= m.evolveAt)
      ? { name: m.evo.name, glyph: m.evo.glyph || m.glyph, color: m.evo.color || m.color, evolved: true }
      : { name: m.name, glyph: m.glyph, color: m.color, evolved: false };
  }

  /* ---------------- player + state --------------------------------------- */
  const player = { tx: 7, ty: 6, px: 7 * TILE, py: 6 * TILE, dir: 'down', moving: false };
  let frame = 0, mode = 'world', pending = null, firstInput = false;

  /* ---------------- pixel-art sprites (4 dir + 2 walk frames) ------------ */
  const PAL = { h: '#c0392b', s: '#f1c27d', k: '#15131f', b: '#2e6fdb', w: '#ffffff', p: '#3a3f4b' };
  const BODIES = {
    down: ['....hhhh....', '...hhhhhh...', '..hhssssh...', '..hskssksh..', '..hssssssh..', '...ssssss...', '..bbbbbbbb..', '.bbwbbbbwbb.', '.bbbbbbbbbb.', '..bbbbbbbb..'],
    up:   ['....hhhh....', '...hhhhhh...', '..hhhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..', '...ssssss...', '..bbbbbbbb..', '.bbbbbbbbbb.', '.bbbbbbbbbb.', '..bbbbbbbb..'],
    side: ['....hhhh....', '...hhhhhh...', '..hhsssss...', '..hsssksss..', '..hsssssss..', '...ssssss...', '..bbbbbb....', '.bbbbbbbb...', '.bbbbbbbb...', '..bbbbbb....'],
  };
  const LEGS = [
    ['..pp....pp..', '..pp....pp..', '..kk....kk..', '..kk....kk..'],
    ['..pp....pp..', '...pp..pp...', '...kk..kk...', '....k..k....'],
  ];
  function drawSprite(grid, ox, oy, flip) {
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
      const ch = grid[r][c]; if (ch === '.') continue;
      ctx.fillStyle = PAL[ch] || '#000';
      const cx = flip ? grid[r].length - 1 - c : c;
      ctx.fillRect(ox + cx, oy + r, 1, 1);
    }
  }

  /* ---------------- tiles ------------------------------------------------- */
  function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function drawTile(t, x, y) {
    const X = x * TILE, Y = y * TILE;
    px(X, Y, TILE, TILE, '#2e7d32');
    px(X + 2, Y + 5, 2, 2, '#256a2a'); px(X + 9, Y + 11, 2, 2, '#256a2a');
    if (t === 'P') { px(X, Y, TILE, TILE, '#cdb98a'); px(X + 3, Y + 3, 2, 2, '#bda874'); px(X + 10, Y + 8, 2, 2, '#bda874'); }
    if (t === 'g') { px(X, Y, TILE, TILE, '#1f6b27'); ctx.fillStyle = '#37a83f'; for (let i = 0; i < 4; i++) ctx.fillRect(X + 1 + i * 4, Y + 6 + ((i % 2) * 2), 2, 8); }
    if (t === 'T') { px(X + 6, Y + 9, 4, 7, '#6b4423'); px(X + 2, Y, 12, 11, '#1b5e20'); px(X + 4, Y + 2, 8, 6, '#2e8b3a'); }
    if (t === 'H' || t === 'D') { px(X, Y, TILE, TILE, '#7d6b8a'); px(X, Y, TILE, 5, '#b03a48'); px(X + 1, Y + 1, 2, 2, '#d05060'); }
    if (t === 'D') { px(X + 5, Y + 7, 6, 9, '#3a2a18'); px(X + 9, Y + 11, 1, 2, '#ffd23f'); px(X + 4, Y + 5, 8, 2, '#ffd23f'); } // gym door w/ gold sign
    if (t === 'S') { px(X + 5, Y + 9, 6, 7, '#6b4423'); px(X + 4, Y + 4, 8, 6, '#d8c089'); px(X + 5, Y + 5, 6, 1, '#6b4423'); px(X + 5, Y + 7, 6, 1, '#6b4423'); }
  }

  /* ---------------- render loop ------------------------------------------ */
  function render() {
    frame++;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) drawTile(MAP[y][x], x, y);
    const key = (player.dir === 'left' || player.dir === 'right') ? 'side' : player.dir;
    const lf = player.moving ? (Math.floor(frame / 5) % 2) : 0;
    drawSprite(BODIES[key].concat(LEGS[lf]), Math.round(player.px) + 2, Math.round(player.py) + 1, player.dir === 'left');
    requestAnimationFrame(render);
  }

  /* ---------------- movement --------------------------------------------- */
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function kick() { if (!firstInput) { firstInput = true; Sound.startMusic(); muteLabel(); } }
  function tryMove(dir) {
    kick();
    if (mode !== 'world' || player.moving) { pending = dir; return; }
    player.dir = dir;
    const [dx, dy] = DV[dir], nx = player.tx + dx, ny = player.ty + dy;
    if (!walkable(nx, ny)) { Sound.click(); return; }
    player.moving = true;
    const sx = player.px, sy = player.py, ex = nx * TILE, ey = ny * TILE, dur = 8;
    let f = 0;
    (function stepm() {
      f++;
      const t = f / dur;
      player.px = sx + (ex - sx) * t; player.py = sy + (ey - sy) * t;
      if (f < dur) return setTimeout(stepm, 18);
      player.tx = nx; player.ty = ny; player.px = ex; player.py = ey; player.moving = false;
      SAVE.steps++;
      if (tileAt(nx, ny) === 'g' && Math.random() < 0.28) return startWild();
      if (pending) { const d = pending; pending = null; tryMove(d); }
    })();
  }

  /* ---------------- interact --------------------------------------------- */
  const dlg = document.getElementById('dialog');
  function interact() {
    kick();
    if (mode === 'dialog') { mode = 'world'; dlg.classList.remove('on'); return; }
    if (mode !== 'world') return;
    const [dx, dy] = DV[player.dir], t = tileAt(player.tx + dx, player.ty + dy);
    if (t === 'S') showDialog('SIGN: "Welcome to Theory Town. Wild Clef-mon hide in the tall grass. Read the note they show you to befriend them!"');
    else if (t === 'D') {
      if (SAVE.dex.length >= MONKEYS.length) startGym();
      else showDialog('CLEF GYM — locked. "Catch all 4 Clef-mon in the grass, then face the Maestro." (' + SAVE.dex.length + '/4 caught)');
    }
  }
  function showDialog(txt) { mode = 'dialog'; dlg.textContent = txt + '  ▸'; dlg.classList.add('on'); Sound.click(); }

  /* ---------------- battle (shared engine) ------------------------------- */
  const overlay = document.getElementById('overlay');
  const box = document.getElementById('box');
  let battle = null;

  function flashThen(cb) {
    const f = document.createElement('div');
    f.style.cssText = 'position:absolute;inset:0;background:#fff;z-index:9;pointer-events:none;';
    document.getElementById('stage').appendChild(f);
    f.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 480 })
      .onfinish = () => { f.remove(); cb(); };
  }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function choicesFor(letter) {
    const o = Music.LETTERS.filter((l) => l !== letter).sort(() => Math.random() - 0.5).slice(0, 3);
    return [letter, ...o].sort(() => Math.random() - 0.5);
  }

  function startWild() {
    Sound.unlock();
    const key = rnd(MONKEYS), m = MONS[key], d = disp(key);
    battle = {
      kind: 'wild', key, hp: 3, max: 3,
      title: 'WILD ' + d.name, glyph: d.glyph, color: d.color,
      draw: () => ({ clef: m.clef, note: rnd(m.pool) }),
      onWin: () => capture(key),
    };
    flashThen(() => { mode = 'battle'; overlay.classList.add('on'); battleQuestion('A wild ' + d.name + ' appeared! It guards ' + m.teaches + '.'); });
  }
  function startGym() {
    Sound.unlock();
    battle = {
      kind: 'gym', hp: 6, max: 6,
      title: 'MAESTRO CLEF', glyph: '♬', color: '#b06aff',
      draw: () => { const m = MONS[rnd(MONKEYS)]; return { clef: m.clef, note: rnd(m.pool) }; },
      onWin: earnBadge,
    };
    flashThen(() => { mode = 'battle'; overlay.classList.add('on'); battleQuestion('MAESTRO CLEF: "Show me you can read the whole staff!" (6 to win)'); });
  }

  function battleQuestion(flash) {
    const { clef, note } = battle.draw();
    battle.note = note; battle.clef = clef;
    const choices = choicesFor(note.letter);
    box.innerHTML = `
      <h2>${battle.title}</h2>
      <div class="mon" style="background:${battle.color}">${battle.glyph}</div>
      <div class="hpwrap">${battle.kind === 'gym' ? 'CHALLENGE' : 'FRIENDSHIP'}</div>
      <div class="hp"><i style="width:${(battle.hp / battle.max) * 100}%"></i></div>
      <div class="feedback" id="fb">${flash || 'Name the note.'}</div>
      <div class="staffwrap">${Music.staffSVG(clef, note, {})}</div>
      <div class="grid4">${choices.map((c) => `<button class="btn ans" data-a="${c}">${c}</button>`).join('')}</div>
      <div style="text-align:center;margin-top:6px"><button class="btn ghost" id="flee">RUN</button></div>`;
    box.querySelectorAll('.ans').forEach((b) => b.addEventListener('click', () => answer(b.getAttribute('data-a'), b)));
    box.querySelector('#flee').addEventListener('click', endBattle);
    setTimeout(() => Sound.note(note.letter, note.octave), 180);
  }
  function answer(a, btn) {
    const fb = document.getElementById('fb');
    box.querySelectorAll('.ans').forEach((b) => b.disabled = true);
    if (a === battle.note.letter) {
      Sound.correct(); btn.classList.add('good'); battle.hp--;
      fb.className = 'feedback good'; fb.textContent = battle.kind === 'gym' ? '✓ Correct!' : '✓ It trusts you more...';
      if (battle.hp <= 0) return setTimeout(battle.onWin, 700);
      setTimeout(() => battleQuestion('✓ Keep going!'), 750);
    } else {
      Sound.wrong(); fb.className = 'feedback bad'; fb.textContent = '✗ That was ' + battle.note.letter + '.';
      setTimeout(() => battleQuestion('Try again.'), 1050);
    }
  }
  function endBattle() { mode = 'world'; overlay.classList.remove('on'); battle = null; }

  function capture() {
    const key = battle.key, m = MONS[key];
    const before = SAVE.captures[key] || 0;
    const isNew = !SAVE.dex.includes(key);
    if (isNew) SAVE.dex.push(key);
    SAVE.captures[key] = before + 1;
    save(); refreshTop();
    const justEvolved = m.evolveAt && before < m.evolveAt && SAVE.captures[key] >= m.evolveAt;
    // hold the evolved reveal for the WHAT?! screen — show the base form here
    const d = justEvolved ? { name: m.name, glyph: m.glyph, color: m.color } : disp(key);
    Sound.levelup();
    box.innerHTML = `
      <h2 style="color:var(--good)">${isNew ? 'GOTCHA!' : 'BEFRIENDED!'}</h2>
      <div class="mon" style="background:${d.color}">${d.glyph}</div>
      <p>${d.name} joined your Dex.<br>You understand <b style="color:var(--gold)">${m.teaches}</b>.</p>
      <p class="tiny mut">Mastery x${SAVE.captures[key]} — the more you meet it, the stronger it sticks.</p>
      <div style="text-align:center;margin-top:8px">
        ${justEvolved ? '<button class="btn alt" id="evo">WHAT?!</button>' : '<button class="btn good" id="ok">CONTINUE</button>'}
        <button class="btn ghost" id="dex">DEX</button>
      </div>`;
    if (justEvolved) box.querySelector('#evo').addEventListener('click', () => evolveScreen(key));
    else box.querySelector('#ok').addEventListener('click', endBattle);
    box.querySelector('#dex').addEventListener('click', showDex);
  }
  function evolveScreen(key) {
    const m = MONS[key], d = disp(key);
    Sound.levelup();
    box.innerHTML = `
      <h2 style="color:var(--gold)">✨ EVOLUTION ✨</h2>
      <div class="mon" style="background:${d.color}">${d.glyph}</div>
      <p>${m.name} mastered enough to evolve into<br><b style="color:var(--gold)">${d.name}</b>!</p>
      <p class="tiny mut">Deeper mastery of ${m.teaches}.</p>
      <div style="text-align:center;margin-top:8px"><button class="btn good" id="ok">CONTINUE</button></div>`;
    box.querySelector('#ok').addEventListener('click', endBattle);
  }
  function earnBadge() {
    if (!SAVE.badges.includes('staff')) SAVE.badges.push('staff');
    save(); refreshTop();
    Sound.levelup();
    box.innerHTML = `
      <h2 style="color:var(--gold)">🏅 STAFF BADGE!</h2>
      <div class="mon" style="background:#b06aff">♬</div>
      <p>MAESTRO CLEF: "You can read the staff. The Staff Badge is yours."</p>
      <p class="tiny mut">Zone 1 complete. Next regions: rhythm, key signatures, chords... (coming soon)</p>
      <div style="text-align:center;margin-top:8px"><button class="btn good" id="ok">CONTINUE</button></div>`;
    box.querySelector('#ok').addEventListener('click', endBattle);
  }

  function showDex() {
    mode = 'menu'; overlay.classList.add('on');
    const rows = MONKEYS.map((k) => {
      const m = MONS[k], got = SAVE.dex.includes(k), d = disp(k);
      return got
        ? `<p><span style="color:${d.color}">${d.glyph}</span> <b>${d.name}</b>${d.evolved ? ' ✨' : ''} — ${m.teaches} <span class="mut">(x${SAVE.captures[k] || 0})</span></p>`
        : `<p><span class="mut">▢ ??? — undiscovered</span></p>`;
    }).join('');
    box.innerHTML = `<h2>📒 DEX — ${SAVE.dex.length}/4</h2>${rows}
      <p class="tiny mut">Badges: ${SAVE.badges.length ? '🏅 Staff' : 'none yet'}</p>
      <div style="text-align:center;margin-top:8px"><button class="btn good" id="close">CLOSE</button></div>`;
    box.querySelector('#close').addEventListener('click', endBattle);
  }

  /* ---------------- topbar / input --------------------------------------- */
  function refreshTop() {
    document.getElementById('dexcount').textContent = SAVE.dex.length;
    document.getElementById('badges').textContent = SAVE.badges.includes('staff') ? '🏅' : '';
  }
  function muteLabel() { document.getElementById('mute').textContent = 'SOUND: ' + (Sound.musicOn() ? 'ON' : 'OFF'); }

  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.key]) { e.preventDefault(); tryMove(KEYMAP[e.key]); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); interact(); }
  });
  document.querySelectorAll('.dpad button[data-dir]').forEach((b) =>
    b.addEventListener('click', () => tryMove(b.getAttribute('data-dir'))));
  document.getElementById('abtn').addEventListener('click', interact);
  document.getElementById('mute').addEventListener('click', (e) => { e.preventDefault(); Sound.unlock(); Sound.toggleMusic(); muteLabel(); });

  /* ---------------- boot -------------------------------------------------- */
  refreshTop();
  render();
})();
