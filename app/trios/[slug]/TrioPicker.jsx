"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Music, Users } from "lucide-react";
import { INSTRUMENTS, PARTS, PERIODS, PIECES, cleanStudentName, instrumentById, pieceById } from "@/lib/holidayTrios.mjs";
import styles from "./page.module.css";

// Views come from the URL hash (#flute, #flute/joy-to-the-world, #flute/picks) so the phone's
// back button steps back through the picker instead of leaving the page.
function readHash() {
  const [instrument = "", second = ""] = decodeURIComponent(window.location.hash.slice(1)).split("/");
  return { instrument: instrumentById(instrument) ? instrument : "", piece: pieceById(second) ? second : "", board: second === "picks" };
}

function remember(key, value) {
  try { window.localStorage.setItem(`trios:${key}`, value); } catch { /* private window */ }
}

function recall(key) {
  try { return window.localStorage.getItem(`trios:${key}`) || ""; } catch { return ""; }
}

const instrumentLabel = (id) => instrumentById(id)?.label || id;
const partLabel = (n) => ["top", "middle", "bottom"][n - 1];

export default function TrioPicker({ slug }) {
  const [view, setView] = useState({ instrument: "", piece: "", board: false });
  const [pages, setPages] = useState({});
  const [pagesError, setPagesError] = useState("");

  useEffect(() => {
    const sync = () => setView(readHash());
    const timer = setTimeout(() => {
      if (!window.location.hash) {
        const saved = recall("instrument");
        if (instrumentById(saved)) window.history.replaceState(null, "", `#${saved}`);
      }
      sync();
    }, 0);
    window.addEventListener("hashchange", sync);
    return () => { clearTimeout(timer); window.removeEventListener("hashchange", sync); };
  }, []);

  const book = instrumentById(view.instrument)?.book || "";
  useEffect(() => {
    if (!book) return undefined;
    let live = true;
    const timer = setTimeout(async () => {
      setPages({});
      setPagesError("");
      try {
        const response = await fetch(`/api/trios/${slug}?book=${book}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (live) setPages(body.pages);
      } catch (error) {
        if (live) setPagesError(error.message || "The music did not load. Try again.");
      }
    }, 0);
    return () => { live = false; clearTimeout(timer); };
  }, [book, slug]);

  useEffect(() => { window.scrollTo(0, 0); }, [view.instrument, view.piece, view.board]);

  const go = (hash) => { window.location.hash = hash; };

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Music size={20} aria-hidden="true" />
        <span className={styles.barTitle}>Holiday Trios</span>
        {view.instrument && <button type="button" className={styles.barChange} onClick={() => go("")}>{instrumentLabel(view.instrument)}: change</button>}
      </header>
      <main className={styles.main}>
        {!view.instrument && <InstrumentStep onPick={(id) => { remember("instrument", id); go(id); }} />}
        {view.instrument && !view.piece && !view.board && <PieceList instrument={view.instrument} go={go} />}
        {view.instrument && view.piece && (
          <PieceView slug={slug} instrument={view.instrument} piece={pieceById(view.piece)} pages={pages} pagesError={pagesError} go={go} />
        )}
        {view.instrument && view.board && <Board slug={slug} instrument={view.instrument} go={go} />}
      </main>
    </div>
  );
}

function InstrumentStep({ onPick }) {
  return (
    <section>
      <h1 className={styles.title}>What do you play?</h1>
      <p className={styles.lede}>Pick your instrument. You will see the music written for it.</p>
      <div className={styles.instrumentGrid}>
        {INSTRUMENTS.map((instrument) => (
          <button type="button" key={instrument.id} className={styles.instrument} onClick={() => onPick(instrument.id)}>{instrument.label}</button>
        ))}
      </div>
    </section>
  );
}

function PieceList({ instrument, go }) {
  return (
    <section>
      <h1 className={styles.title}>Pick a trio to look at</h1>
      <p className={styles.lede}>Every piece has three parts. Any three instruments can play it together. Tap a piece to read the music.</p>
      <button type="button" className={styles.secondary} onClick={() => go(`${instrument}/picks`)}>
        <Users size={20} aria-hidden="true" /> See who picked what
      </button>
      <ol className={styles.pieceList}>
        {PIECES.map((piece) => (
          <li key={piece.id}>
            <button type="button" className={styles.piece} onClick={() => go(`${instrument}/${piece.id}`)}>
              <span className={styles.pieceTitle}>{piece.title}</span>
              <span className={styles.pieceMeta}>{piece.origin ? `${piece.origin}. ` : ""}{piece.pages.length === 1 ? "1 page" : `${piece.pages.length} pages`}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PieceView({ slug, instrument, piece, pages, pagesError, go }) {
  const shared = PIECES.filter((other) => other.id !== piece.id && other.pages.some((p) => piece.pages.includes(p)));
  return (
    <section>
      <button type="button" className={styles.back} onClick={() => go(instrument)}><ArrowLeft size={20} aria-hidden="true" /> All pieces</button>
      <h1 className={styles.title}>{piece.title}</h1>
      <p className={styles.lede}>
        Each line of music has three staves. Part 1 is the top staff, part 2 is the middle and part 3 is the bottom.
        {shared.length > 0 && ` This page also has ${shared.map((other) => other.title).join(" and ")}.`}
      </p>
      {pagesError && <p className={styles.error} role="alert">{pagesError}</p>}
      <div className={styles.pages}>
        {piece.pages.map((page) => (
          <figure key={page} className={styles.pageFigure}>
            {pages[page]
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={pages[page]} alt={`${piece.title}, ${instrumentLabel(instrument)} music, book page ${page + 2}`} className={styles.pageImage} />
              : <div className={styles.pagePlaceholder} role="status">{pagesError ? "Music not loaded." : "Loading the music…"}</div>}
            <figcaption className={styles.caption}>Book page {page + 2}. Pinch to zoom.</figcaption>
          </figure>
        ))}
      </div>
      <PickForm slug={slug} instrument={instrument} piece={piece} go={go} />
    </section>
  );
}

function PickForm({ slug, instrument, piece, go }) {
  const [part, setPart] = useState(0);
  const [period, setPeriod] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => { setPeriod(recall("period")); setName(recall("name")); }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function save(event) {
    event.preventDefault();
    setError("");
    const clean = cleanStudentName(name);
    if (!/ [A-Z]\.$/.test(clean)) { setError("Type your first name and last initial, like Jordan S."); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/trios/${slug}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, name: clean, instrument, piece: piece.id, part })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      remember("period", period);
      remember("name", clean);
      go(`${instrument}/picks`);
    } catch (e) {
      setError(e.message || "Your pick did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <h2 className={styles.formTitle}>Want to play this one?</h2>
      <p className={styles.hint}>Saving again later replaces your pick, so you can change your mind.</p>
      <fieldset className={styles.choiceSet} disabled={saving}>
        <legend>Which part?</legend>
        <div className={styles.choiceRow}>
          {PARTS.map((n) => (
            <label key={n} className={styles.choice}>
              <input type="radio" name="part" value={n} checked={part === n} onChange={() => setPart(n)} required />
              <span>Part {n}<small>{partLabel(n)} staff</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.choiceSet} disabled={saving}>
        <legend>Your class</legend>
        <div className={styles.choiceRow}>
          {PERIODS.map((p) => (
            <label key={p.id} className={styles.choice}>
              <input type="radio" name="period" value={p.id} checked={period === p.id} onChange={() => setPeriod(p.id)} required />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={styles.nameField}>
        <span>First name and last initial</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan S." autoComplete="off" maxLength={40} required disabled={saving} />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.primary} disabled={saving || !part || !period}>
        <Check size={20} aria-hidden="true" /> {saving ? "Saving…" : `Pick ${piece.title}, part ${part || "?"}`}
      </button>
    </form>
  );
}

function Board({ slug, instrument, go }) {
  const [period, setPeriod] = useState("");
  const [picks, setPicks] = useState(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => { setPeriod(recall("period") || "1"); setMe(recall("name")); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    if (!period) return;
    setError("");
    try {
      const response = await fetch(`/api/trios/${slug}/picks?period=${period}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPicks(body.picks);
    } catch (e) {
      setError(e.message || "The list did not load. Try again.");
    }
  }, [period, slug]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 15000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const mine = picks?.find((pick) => pick.name === me);
  const byPiece = PIECES.map((piece) => ({ piece, picks: (picks || []).filter((pick) => pick.piece === piece.id) })).filter((group) => group.picks.length);

  return (
    <section>
      <button type="button" className={styles.back} onClick={() => go(instrument)}><ArrowLeft size={20} aria-hidden="true" /> All pieces</button>
      <h1 className={styles.title}>Who picked what</h1>
      {mine && <p className={styles.saved}><Check size={20} aria-hidden="true" /> Saved: {pieceById(mine.piece)?.title}, part {mine.part}.</p>}
      <div className={styles.choiceRow} role="group" aria-label="Class period">
        {PERIODS.map((p) => (
          <button type="button" key={p.id} className={period === p.id ? styles.tabOn : styles.tab} aria-pressed={period === p.id} onClick={() => { setPeriod(p.id); setPicks(null); }}>{p.label}</button>
        ))}
      </div>
      <p className={styles.hint}>Find two people on the other parts of the same piece. This list updates on its own.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!picks && !error && <p role="status">Loading…</p>}
      {picks && byPiece.length === 0 && <p>No one in this class has picked yet.</p>}
      <div className={styles.board}>
        {byPiece.map(({ piece, picks: group }) => (
          <article key={piece.id} className={styles.boardCard}>
            <h2 className={styles.boardTitle}>{piece.title}</h2>
            <div className={styles.partGrid}>
              {PARTS.map((n) => {
                const players = group.filter((pick) => pick.part === n);
                return (
                  <div key={n} className={styles.partCol}>
                    <span className={styles.partHead}>Part {n}</span>
                    {players.length
                      ? <ul>{players.map((pick) => <li key={pick.name}>{pick.name} <small>{instrumentLabel(pick.instrument)}</small></li>)}</ul>
                      : <span className={styles.open}>Open</span>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
