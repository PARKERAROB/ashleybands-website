/* Theory Quest — engine. Renders every screen into #app, runs the encounter
   loop, and persists progress. The curriculum (data) drives everything here;
   adding zones never touches this file. */
(function () {
  const app = document.getElementById('app');
  const ZONES = CURRICULUM.zones;

  /* ---------------- save (localStorage now; shaped for a future DB row) ----- */
  const SAVE_KEY = 'theoryQuestSave_v1';
  const fresh = () => ({
    version: 1,
    studentId: null,              // future hook: bind to a student backend
    xp: 0,
    lessonsCleared: [],           // ["z1l2", "z1lboss", ...]
    zonesCleared: [],             // [1, ...]
    spellbook: [],                // collected loot names
    created: Date.now(),
    updated: Date.now(),
  });
  let SAVE = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.version === 1 ? s : fresh(); }
    catch (e) { return fresh(); }
  }
  function persist() { SAVE.updated = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
  function resetSave() { SAVE = fresh(); persist(); }

  const key = (zid, l) => `z${zid}l${l}`;               // l = lesson id | 'mini' | 'boss'
  const done = (zid, l) => SAVE.lessonsCleared.includes(key(zid, l));
  const award = (zid, l, xp, loot) => {
    if (!done(zid, l)) { SAVE.lessonsCleared.push(key(zid, l)); SAVE.xp += xp; }
    if (loot && !SAVE.spellbook.includes(loot)) SAVE.spellbook.push(loot);
    persist();
  };
  const level = () => 1 + Math.floor(SAVE.xp / 100);

  /* ---------------- small utils ------------------------------------------- */
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  function sample(arr, n) {           // up to n picks, avoid back-to-back repeat
    const out = []; let last = null;
    for (let i = 0; i < n; i++) { let p = rnd(arr); if (arr.length > 1) while (p === last) p = rnd(arr); out.push(p); last = p; }
    return out;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- encounter generation ---------------------------------- */
  // expand a zone's encounter specs into a flat queue of concrete questions
  function buildQueue(specs) {
    const q = [];
    specs.forEach((spec) => {
      for (let i = 0; i < (spec.count || 1); i++) q.push(makeQuestion(spec));
    });
    return q;
  }
  function letterChoices(correct) {
    const others = shuffle(Music.LETTERS.filter((l) => l !== correct)).slice(0, 3);
    return shuffle([correct, ...others]);
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function makeQuestion(spec) {
    switch (spec.kind) {
      case 'noteId': {
        const note = rnd(POOLS[spec.pool]);
        return { kind: 'noteId', clef: spec.clef, note, answer: note.letter, choices: letterChoices(note.letter) };
      }
      case 'placeNote': {
        const t = spec.target;
        return { kind: 'placeNote', clef: spec.clef, target: t };
      }
      case 'earHighLow': {
        let [a, b] = sample(POOLS.earWide, 2);
        let fa = Music.freq(a.letter, a.octave), fb = Music.freq(b.letter, b.octave);
        // ensure an audible gap and that they differ
        let guard = 0;
        while (Math.abs(Math.log2(fa / fb)) < 0.18 && guard++ < 20) { b = rnd(POOLS.earWide); fb = Music.freq(b.letter, b.octave); }
        return { kind: 'earHighLow', a, b, fa, fb, answer: fa > fb ? 'A' : 'B' };
      }
      case 'earRegister': {
        const high = Math.random() < 0.5;
        const note = rnd(high ? POOLS.earHigh : POOLS.earLow);
        return { kind: 'earRegister', note, answer: high ? 'HIGH' : 'LOW' };
      }
      default: return { kind: 'noteId', clef: 'treble', note: N('G', 4), answer: 'G', choices: ['G', 'A', 'B', 'C'] };
    }
  }
  const N = (letter, octave) => ({ letter, octave });

  /* ---------------- screen plumbing --------------------------------------- */
  function render(html) { app.innerHTML = html; window.scrollTo(0, 0); }
  function on(sel, ev, fn) { app.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn)); }

  function hud(run) {
    const lvl = level();
    const pct = Math.max(0, Math.min(100, run.tuning));
    return `<div class="hud">
      <div class="stat">LV <b>${lvl}</b></div>
      <div class="stat">XP <b>${SAVE.xp}</b></div>
      <div class="stat">🔥 <b>${run.streak}</b></div>
      <div class="meter">
        <div class="lbl">TUNING ${pct}%</div>
        <div class="bar ${pct <= 30 ? 'low' : ''}"><i style="width:${pct}%"></i></div>
      </div>
    </div>`;
  }

  /* ---------------- title -------------------------------------------------- */
  function titleScreen() {
    render(`
      <div class="title-hero">
        <div class="big">★ THEORY<br>QUEST ★</div>
        <div class="sub">AN 8-BIT MUSIC THEORY RPG</div>
        <p class="mut tiny" style="margin-top:18px">Read music. Train your ear.<br>Clear the staff, one quest at a time.</p>
        <div style="margin-top:26px"><button class="btn lg" id="start">▶ PRESS START</button></div>
        <p class="blink tiny" style="margin-top:16px;color:var(--gold)">${SAVE.xp > 0 ? 'CONTINUE — LV ' + level() : 'NEW GAME'}</p>
      </div>
      <div class="footer">
        Ashley HS Bands · curriculum after <i>${esc(CURRICULUM.source)}</i><br>
        <a href="/">ashleybands.com</a>
      </div>`);
    on('#start', 'click', () => { Sound.unlock(); Sound.click(); mapScreen(); });
  }

  /* ---------------- world map --------------------------------------------- */
  const zoneUnlocked = (z) => z.id === 1 || SAVE.zonesCleared.includes(z.id - 1);
  const BOOK_NAMES = { 1: 'BOOK I · FOUNDATIONS', 2: 'BOOK II · THE CLIMB', 3: 'BOOK III · MASTERY' };

  function mapScreen() {
    let html = `<div class="crumbs"><a id="toTitle">TITLE</a> › WORLD MAP</div>
      <div class="panel center">
        <h1>WORLD MAP</h1>
        <p class="mut tiny">LV ${level()} · ${SAVE.xp} XP · ${SAVE.spellbook.length} relics · ${SAVE.zonesCleared.length}/${ZONES.length} zones cleared</p>
      </div>`;
    let lastBook = null;
    ZONES.forEach((z) => {
      if (z.book !== lastBook) { html += `<div class="book-band">${BOOK_NAMES[z.book]}</div>`; lastBook = z.book; }
      const built = !!z.lessons;
      const unlocked = zoneUnlocked(z);
      const cleared = SAVE.zonesCleared.includes(z.id);
      const cls = !unlocked ? 'locked' : (cleared ? 'cleared' : '');
      const tag = cleared ? '✔ CLEAR' : (!built ? 'SOON' : (unlocked ? 'PLAY ▶' : '🔒'));
      html += `<div class="zone ${cls}" data-zone="${unlocked && built ? z.id : ''}">
        <div class="num">${z.id}</div>
        <div class="meta"><b>${esc(z.name)}</b><span>Unit ${z.unit} · ${esc(z.blurb)}</span></div>
        <div class="tag">${tag}</div>
      </div>`;
    });
    if (SAVE.spellbook.length) {
      html += `<div class="panel"><h3>🎒 SPELLBOOK</h3>${SAVE.spellbook.map((l) => `<span class="loot">${esc(l)}</span>`).join('')}</div>`;
    }
    html += `<div class="panel center"><button class="btn ghost tiny" id="reset">RESET PROGRESS</button></div>`;
    render(html);
    on('#toTitle', 'click', titleScreen);
    on('.zone', 'click', (e) => {
      const id = e.currentTarget.getAttribute('data-zone');
      if (!id) return;
      Sound.click(); zoneScreen(+id);
    });
    on('#reset', 'click', () => { if (confirm('Erase all Theory Quest progress?')) { resetSave(); mapScreen(); } });
  }

  /* ---------------- zone (node path) -------------------------------------- */
  function zoneNodes(z) {
    const nodes = z.lessons.map((l) => ({ kind: 'lesson', l, label: 'Lesson ' + l.id, title: l.title, ico: '♪' }));
    nodes.push({ kind: 'mini', l: 'mini', label: 'Mini-Boss', title: z.miniBoss.title, ico: '👂' });
    nodes.push({ kind: 'boss', l: 'boss', label: 'ZONE BOSS', title: z.boss.title, ico: '👑' });
    return nodes;
  }
  function nodeUnlocked(z, nodes, i) {
    if (i === 0) return true;
    const prev = nodes[i - 1];
    return done(z.id, prev.l);
  }
  function zoneScreen(zid) {
    const z = ZONES.find((x) => x.id === zid);
    const nodes = zoneNodes(z);
    let html = `<div class="crumbs"><a id="toMap">WORLD MAP</a> › ZONE ${z.id}</div>
      <div class="panel">
        <h1>${z.id}. ${esc(z.name)}</h1>
        <p class="tiny">${esc(z.blurb)}</p>
      </div>`;
    nodes.forEach((node, i) => {
      const unlocked = nodeUnlocked(z, nodes, i);
      const cleared = done(z.id, node.l);
      const cls = cleared ? 'cleared' : (unlocked ? '' : 'locked');
      const tag = cleared ? '✔' : (unlocked ? '▶' : '🔒');
      html += `<div class="node ${cls}" data-node="${unlocked ? i : ''}">
        <div class="ico">${node.ico}</div>
        <div class="meta"><b>${node.label}: ${esc(node.title)}</b><span>${cleared ? 'Cleared' : (unlocked ? 'Ready' : 'Locked — clear the step above')}</span></div>
        <div class="tag">${tag}</div>
      </div>`;
    });
    render(html);
    on('#toMap', 'click', mapScreen);
    on('.node', 'click', (e) => {
      const i = e.currentTarget.getAttribute('data-node');
      if (i === '') return;
      Sound.click(); teachScreen(z, nodes[+i]);
    });
  }

  /* ---------------- teach card -------------------------------------------- */
  function stageOf(z, node) {
    if (node.kind === 'lesson') return node.l;
    if (node.kind === 'mini') return z.miniBoss;
    return z.boss;
  }
  function teachScreen(z, node) {
    const stage = stageOf(z, node);
    const isLesson = node.kind === 'lesson';
    render(`<div class="crumbs"><a id="toZone">ZONE ${z.id}</a> › ${node.label}</div>
      <div class="panel">
        <h2>${esc(stage.title)}</h2>
        <p>${stage.teach}</p>
        ${node.kind === 'boss' ? '<p class="tiny" style="color:var(--bad)">Boss fight: tougher, and your tuning matters. Clear it to unlock the next zone.</p>' : ''}
        <div class="center" style="margin-top:14px"><button class="btn lg" id="begin">${node.kind === 'lesson' ? 'BEGIN ♪' : 'FIGHT!'}</button></div>
      </div>`);
    on('#toZone', 'click', () => zoneScreen(z.id));
    on('#begin', 'click', () => startRun(z, node));
  }

  /* ---------------- encounter run ----------------------------------------- */
  function startRun(z, node) {
    const stage = stageOf(z, node);
    const boss = node.kind !== 'lesson';
    const run = {
      z, node, stage,
      queue: buildQueue(stage.encounters),
      idx: 0,
      tuning: 100,
      drop: boss ? 18 : 14,    // tuning lost per miss
      streak: 0,
      correct: 0,
      xpGained: 0,
      boss,
    };
    nextQuestion(run);
  }

  function nextQuestion(run) {
    if (run.idx >= run.queue.length) return finishRun(run, true);
    const q = run.queue[run.idx];
    const total = run.queue.length;
    let body = '';
    if (q.kind === 'noteId') {
      body = `<div class="q">Name this note</div>
        <div class="staffwrap">${Music.staffSVG(q.clef, q.note, {})}</div>
        <div class="grid4">${q.choices.map((c) => `<button class="btn ans" data-ans="${c}">${c}</button>`).join('')}</div>`;
    } else if (q.kind === 'placeNote') {
      body = `<div class="q">Place the note: <b>${q.target.letter}</b> <span class="tiny mut">(${q.clef} clef)</span></div>
        <div class="staffwrap">${Music.staffSVG(q.clef, null, { click: true, showNote: false })}</div>
        <p class="tiny mut center">Tap the line or space where ${q.target.letter} belongs.</p>`;
    } else if (q.kind === 'earHighLow') {
      body = `<div class="q">Which note is higher?</div>
        <div class="row center" style="justify-content:center;margin:14px 0">
          <button class="btn alt" id="playA">▶ PLAY A</button>
          <button class="btn alt" id="playB">▶ PLAY B</button>
        </div>
        <div class="grid2"><button class="btn ans" data-ans="A">A is higher</button><button class="btn ans" data-ans="B">B is higher</button></div>`;
    } else if (q.kind === 'earRegister') {
      body = `<div class="q">Listen — is it high or low?</div>
        <div class="center" style="margin:14px 0"><button class="btn alt" id="playTone">▶ PLAY NOTE</button></div>
        <div class="grid2"><button class="btn ans" data-ans="HIGH">HIGH</button><button class="btn ans" data-ans="LOW">LOW</button></div>`;
    }
    render(`${hud(run)}
      <div class="crumbs">${esc(run.stage.title)} · ${run.idx + 1}/${total}</div>
      <div class="panel">${body}<div class="feedback" id="fb"></div></div>`);

    // auto-play ear questions on load
    if (q.kind === 'earHighLow') { setTimeout(() => { Sound.freqTone(q.fa); setTimeout(() => Sound.freqTone(q.fb), 950); }, 250); }
    if (q.kind === 'earRegister') { setTimeout(() => Sound.note(q.note.letter, q.note.octave), 250); }

    on('#playA', 'click', () => Sound.freqTone(q.fa));
    on('#playB', 'click', () => Sound.freqTone(q.fb));
    on('#playTone', 'click', () => Sound.note(q.note.letter, q.note.octave));
    on('.ans', 'click', (e) => grade(run, q, e.currentTarget.getAttribute('data-ans'), e.currentTarget));
    on('.hit', 'click', (e) => {
      const step = +e.currentTarget.getAttribute('data-step');
      gradePlace(run, q, step);
    });
  }

  function lockButtons() { app.querySelectorAll('.ans,.hit').forEach((b) => { b.disabled = true; b.style.pointerEvents = 'none'; }); }
  function fb(ok, msg) {
    const el = document.getElementById('fb');
    if (el) { el.className = 'feedback ' + (ok ? 'good' : 'bad'); el.textContent = msg; }
  }

  function resolve(run, ok, msg, correctBtn) {
    lockButtons();
    if (ok) { Sound.correct(); run.streak++; run.correct++; run.xpGained += 10 + Math.min(run.streak, 5) * 2; }
    else { Sound.wrong(); run.streak = 0; run.tuning -= run.drop; }
    fb(ok, msg);
    if (correctBtn && ok) correctBtn.classList.add('good');
    if (run.tuning <= 0) return setTimeout(() => finishRun(run, false), 800);
    run.idx++;
    setTimeout(() => nextQuestion(run), ok ? 650 : 1050);
  }
  function grade(run, q, ans, btn) {
    const ok = ans === q.answer;
    let msg = ok ? '✓ Correct!' : '✗ It was ' + niceAnswer(q);
    resolve(run, ok, msg, btn);
  }
  function gradePlace(run, q, step) {
    const ok = Music.stepLetter(step) === q.target.letter;
    resolve(run, ok, ok ? '✓ Correct!' : '✗ That is ' + Music.stepLetter(step) + ', not ' + q.target.letter, null);
  }
  function niceAnswer(q) {
    if (q.kind === 'noteId') return q.answer;
    if (q.kind === 'earHighLow') return q.answer === 'A' ? 'A' : 'B';
    if (q.kind === 'earRegister') return q.answer;
    return q.answer;
  }

  /* ---------------- results ----------------------------------------------- */
  function finishRun(run, survived) {
    const z = run.z, node = run.node;
    const passScore = run.correct >= Math.ceil(run.queue.length * 0.6);
    const win = survived && passScore;
    if (win) {
      const loot = node.kind === 'lesson' && z.loot ? z.loot[(z.lessons.findIndex((l) => l.id === node.l)) % z.loot.length] : null;
      award(z.id, node.l, run.xpGained, loot);
      if (node.kind === 'boss' && !SAVE.zonesCleared.includes(z.id)) { SAVE.zonesCleared.push(z.id); persist(); }
      Sound.levelup();
      const nextZone = ZONES.find((x) => x.id === z.id + 1);
      const unlockedNext = node.kind === 'boss' && nextZone;
      render(`<div class="panel center">
        <h1>${node.kind === 'boss' ? '👑 ZONE CLEARED!' : '✓ CLEARED!'}</h1>
        <p>${esc(run.stage.title)}</p>
        <p class="tiny">Score ${run.correct}/${run.queue.length} · +${run.xpGained} XP · tuning ${Math.max(0, run.tuning)}%</p>
        ${loot ? `<p class="tiny" style="color:var(--gold)">RELIC FOUND: <span class="loot">${esc(loot)}</span></p>` : ''}
        ${unlockedNext ? `<p class="tiny" style="color:var(--good)">🔓 Zone ${nextZone.id} — ${esc(nextZone.name)} ${nextZone.lessons ? 'unlocked!' : 'coming soon'}</p>` : ''}
        <div style="margin-top:16px">
          <button class="btn good" id="cont">CONTINUE ▶</button>
          ${unlockedNext && nextZone.lessons ? `<button class="btn alt" id="next">ZONE ${nextZone.id} ▶</button>` : ''}
        </div>
      </div>`);
      on('#cont', 'click', () => zoneScreen(z.id));
      on('#next', 'click', () => zoneScreen(z.id + 1));
    } else {
      Sound.fail();
      render(`<div class="panel center">
        <h1 style="color:var(--bad)">${survived ? 'NOT QUITE' : 'OUT OF TUNE'}</h1>
        <p class="tiny">${survived ? 'Score ' + run.correct + '/' + run.queue.length + ' — clear 60% to pass.' : 'Your tuning ran out. The staff resets — try again.'}</p>
        <p class="mut tiny">No progress lost. Practice makes a musician.</p>
        <div style="margin-top:16px">
          <button class="btn" id="retry">RETRY ▶</button>
          <button class="btn ghost" id="back">ZONE MAP</button>
        </div>
      </div>`);
      on('#retry', 'click', () => teachScreen(z, node));
      on('#back', 'click', () => zoneScreen(z.id));
    }
  }

  /* ---------------- boot --------------------------------------------------- */
  titleScreen();
})();
