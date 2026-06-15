"use client";

// Band of Heroes — remote controller (Rob's phone / iPad, private link).
// This is the state AUTHORITY: it holds the current slide + vote state, receives
// audience votes, and broadcasts a unified "state" so the projected display and
// the audience phones both follow. Rob drives the whole show from his hand.

import { useCallback, useEffect, useRef, useState } from "react";
import { byId, renderSlide } from "../slideView";
import { PROGRAM_START } from "../program";
import { getLiveClient, BOH_CHANNEL } from "@/lib/bandOfHeroes/live";

function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export default function Controller() {
  const [current, setCurrent] = useState(PROGRAM_START);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | open | closed
  const [counts, setCounts] = useState({ a: 0, b: 0 });
  const [winner, setWinner] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [duration, setDuration] = useState(20);
  const [connected, setConnected] = useState(false);

  const slide = byId.get(current) || byId.get(1);
  const isVote = !!slide.choices;
  const optionA = slide.choices?.[0]?.label;
  const optionB = slide.choices?.[1]?.label;
  const winnerLabel = winner ? (winner === "a" ? optionA : optionB) : null;

  // refs the broadcast + handlers read (avoid stale closures)
  const channelRef = useRef(null);
  const sessionRef = useRef(null);
  const slideRef = useRef(PROGRAM_START);
  const statusRef = useRef("idle");
  const optionsRef = useRef({ a: null, b: null });
  const countRef = useRef({ a: 0, b: 0 });
  const winnerRef = useRef(null);
  const votesRef = useRef(new Map());
  const tickRef = useRef(null);
  const beatRef = useRef(null);
  const pendingRef = useRef(false);
  const initedRef = useRef(false);
  const cvRef = useRef(null);

  const broadcast = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "state",
      payload: {
        sessionId: sessionRef.current,
        slideId: slideRef.current,
        round: slideRef.current,
        status: statusRef.current,
        optionA: optionsRef.current.a,
        optionB: optionsRef.current.b,
        counts: countRef.current,
        winner: winnerRef.current
      }
    });
  }, []);

  const scheduleBroadcast = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setTimeout(() => { pendingRef.current = false; broadcast(); }, 180);
  }, [broadcast]);

  const recount = useCallback(() => {
    let a = 0, b = 0;
    votesRef.current.forEach((v) => { if (v === "a") a++; else if (v === "b") b++; });
    countRef.current = { a, b };
    setCounts({ a, b });
  }, []);

  // Move to a slide (narrative state): clears any vote.
  const applySlide = useCallback((id) => {
    slideRef.current = id;
    statusRef.current = "idle";
    optionsRef.current = { a: null, b: null };
    winnerRef.current = null;
    countRef.current = { a: 0, b: 0 };
    votesRef.current = new Map();
    clearInterval(tickRef.current);
    setTimeLeft(null);
    setCurrent(id);
    setStatus("idle");
    setWinner(null);
    setCounts({ a: 0, b: 0 });
    broadcast();
  }, [broadcast]);

  // ── Live channel ────────────────────────────────────────
  useEffect(() => {
    let client;
    try { client = getLiveClient(); } catch { return; }
    const ch = client.channel(BOH_CHANNEL);
    channelRef.current = ch;

    ch.on("broadcast", { event: "vote" }, ({ payload }) => {
      if (!payload || statusRef.current !== "open") return;
      if (payload.sessionId !== sessionRef.current || payload.round !== slideRef.current) return;
      if (payload.choice !== "a" && payload.choice !== "b") return;
      votesRef.current.set(payload.deviceId, payload.choice);
      recount();
      scheduleBroadcast();
    });
    ch.on("broadcast", { event: "hello" }, () => broadcast());

    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") {
        setConnected(true);
        if (!initedRef.current) {
          initedRef.current = true;
          sessionRef.current = newSessionId();
          applySlide(PROGRAM_START); // open on the concert program (Start over returns here too)
        } else {
          broadcast();
        }
        clearInterval(beatRef.current);
        beatRef.current = setInterval(broadcast, 2500);
      }
    });

    return () => {
      clearInterval(beatRef.current);
      clearInterval(tickRef.current);
      try { client.removeChannel(ch); } catch {}
    };
  }, [applySlide, broadcast, recount, scheduleBroadcast]);

  // ── Navigation ──────────────────────────────────────────
  const go = useCallback((id) => {
    setHistory((h) => [...h, slideRef.current]);
    applySlide(id);
  }, [applySlide]);

  const advance = useCallback(() => {
    if (slide.choices || slide.end) return;
    go(slide.next ?? slide.id + 1);
  }, [slide, go]);

  const back = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      applySlide(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, [applySlide]);

  // ── Voting ──────────────────────────────────────────────
  const openVote = useCallback(() => {
    if (!slide.choices) return;
    votesRef.current = new Map();
    countRef.current = { a: 0, b: 0 };
    optionsRef.current = { a: slide.choices[0].label, b: slide.choices[1].label };
    statusRef.current = "open";
    winnerRef.current = null;
    setCounts({ a: 0, b: 0 });
    setWinner(null);
    setStatus("open");
    broadcast();
    setTimeLeft(duration);
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) { clearInterval(tickRef.current); cvRef.current?.(); return 0; }
        return t - 1;
      });
    }, 1000);
  }, [slide, duration, broadcast]);

  const closeVote = useCallback((override) => {
    clearInterval(tickRef.current);
    setTimeLeft(null);
    let w = override || null;
    if (!w) {
      const { a, b } = countRef.current;
      w = a > b ? "a" : b > a ? "b" : null;
    }
    statusRef.current = "closed";
    winnerRef.current = w;
    setStatus("closed");
    setWinner(w);
    broadcast();
  }, [broadcast]);

  useEffect(() => { cvRef.current = closeVote; }, [closeVote]);

  const extend = useCallback(() => setTimeLeft((t) => (t === null ? null : t + 10)), []);

  const continueAfterVote = useCallback(() => {
    if (!winnerRef.current) return;
    const target = slide.choices[winnerRef.current === "a" ? 0 : 1].target;
    go(target);
  }, [slide, go]);

  // "Start over": new session (clears rehearsal votes) + back to the top of the
  // concert program. Always available in the top bar, even when Back is hidden.
  const reset = useCallback(() => {
    sessionRef.current = newSessionId();
    setHistory([]);
    applySlide(PROGRAM_START);
  }, [applySlide]);

  // keyboard (iPad/laptop with keys)
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === " ") { if (!isVote && !slide.end) { e.preventDefault(); advance(); } }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back, isVote, slide]);

  const total = counts.a + counts.b;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="boh-control">
      <div className="boh-bar">
        <span className={`boh-livedot ${connected ? "is-live" : ""}`}>{connected ? "LIVE" : "…"}</span>
        <span className="boh-bar-scene">{slide.scene}</span>
        <span className="boh-bar-spacer" />
        <label className="boh-bar-dur">
          Vote&nbsp;
          <input type="number" min={5} max={120} value={duration}
            onChange={(e) => setDuration(Math.max(5, Math.min(120, Number(e.target.value) || 20)))} />s
        </label>
        <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={reset}>⟲ Start over</button>
      </div>

      <div className="boh-control-stage">
        <div className="boh-text">{renderSlide(slide)}</div>
        {isVote && status === "closed" && winnerLabel && (
          <div className="boh-reveal"><span className="boh-reveal-label">Winner</span><span className="boh-reveal-name">{winnerLabel}</span></div>
        )}
      </div>

      <div className="boh-control-actions">
        {!isVote && (
          <>
            <button className="boh-btn boh-btn--ghost boh-btn--lg" onClick={back} disabled={!history.length}>◀ Back</button>
            {slide.end
              ? <button className="boh-btn boh-btn--primary boh-btn--lg" onClick={reset}>Restart</button>
              : <button className="boh-btn boh-btn--primary boh-btn--lg" onClick={advance}>Next ▶</button>}
          </>
        )}

        {isVote && status !== "open" && status !== "closed" && (
          <>
            <button className="boh-btn boh-btn--ghost boh-btn--lg" onClick={back} disabled={!history.length}>◀ Back</button>
            <button className="boh-btn boh-btn--primary boh-btn--lg" onClick={openVote}>Open Voting ▶</button>
          </>
        )}

        {isVote && status === "open" && (
          <div className="boh-vote-live">
            <div className="boh-tally">
              <div className="boh-tally-row">
                <span className="boh-tally-name">{optionA}</span>
                <div className="boh-tally-track"><div className="boh-tally-fill boh-fill-a" style={{ width: `${pct(counts.a)}%` }} /></div>
                <span className="boh-tally-num">{counts.a}</span>
              </div>
              <div className="boh-tally-row">
                <span className="boh-tally-name">{optionB}</span>
                <div className="boh-tally-track"><div className="boh-tally-fill boh-fill-b" style={{ width: `${pct(counts.b)}%` }} /></div>
                <span className="boh-tally-num">{counts.b}</span>
              </div>
            </div>
            <div className="boh-vote-actions">
              <span className="boh-clock">{timeLeft ?? 0}s</span>
              <button className="boh-btn boh-btn--primary" onClick={() => closeVote()}>Close &amp; Reveal</button>
              <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={extend}>+10s</button>
            </div>
            <div className="boh-override">Override:&nbsp;
              <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={() => closeVote("a")}>{optionA}</button>
              <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={() => closeVote("b")}>{optionB}</button>
            </div>
          </div>
        )}

        {isVote && status === "closed" && (
          <>
            {winnerLabel ? (
              <button className="boh-btn boh-btn--primary boh-btn--lg" onClick={continueAfterVote}>Play {winnerLabel} ▶</button>
            ) : (
              <span className="boh-tie">Tie — you pick:&nbsp;
                <button className="boh-btn boh-btn--primary boh-btn--sm" onClick={() => closeVote("a")}>{optionA}</button>
                <button className="boh-btn boh-btn--primary boh-btn--sm" onClick={() => closeVote("b")}>{optionB}</button>
              </span>
            )}
            <button className="boh-btn boh-btn--ghost boh-btn--lg" onClick={back} disabled={!history.length}>◀ Back</button>
          </>
        )}
      </div>
    </div>
  );
}
