"use client";

// Band of Heroes — presenter view (projected at the concert).
// Runs all 102 story slides locally (works with zero network). The live-voting
// layer is additive: the presenter is the tally authority, audience phones
// broadcast votes, and the presenter can ALWAYS override and pick the winner so
// the band never waits on a server.

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { slides } from "./slides";
import { getLiveClient, BOH_CHANNEL } from "@/lib/bandOfHeroes/live";

const byId = new Map(slides.map((s) => [s.id, s]));

function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

function renderSlide(slide) {
  if (slide.kind === "cover") {
    const [title, ...sub] = slide.lines;
    return (
      <>
        <span className="boh-cover-title">{title}</span>
        {sub.map((line, i) => (
          <span key={i} className="boh-cover-sub">{line}</span>
        ))}
      </>
    );
  }
  if (slide.kind === "title") {
    const hasArticle = slide.lines[0]?.toUpperCase() === "THE";
    const name = hasArticle ? slide.lines.slice(1) : slide.lines;
    return (
      <>
        {hasArticle && <span className="boh-title-the">The</span>}
        {name.map((line, i) => (
          <span key={i} className="boh-title-name">{line}</span>
        ))}
      </>
    );
  }
  return slide.lines.map((line, i) => (
    <span key={i} className="boh-line">{line}</span>
  ));
}

export default function Presenter() {
  const [current, setCurrent] = useState(1);
  const [history, setHistory] = useState([]);
  const slide = byId.get(current) || slides[0];
  const isVote = !!slide.choices;

  const [snap, setSnap] = useState({
    sessionId: null, round: 0, status: "standby", optionA: null, optionB: null, winner: null
  });
  const [counts, setCounts] = useState({ a: 0, b: 0 });
  const [duration, setDuration] = useState(20);
  const [timeLeft, setTimeLeft] = useState(null);
  const [connected, setConnected] = useState(false);
  const [voteUrl, setVoteUrl] = useState("");

  const channelRef = useRef(null);
  const liveRef = useRef({ sessionId: null, round: 0, status: "standby" });
  const snapRef = useRef(snap);
  const votesRef = useRef(new Map());
  const countRef = useRef({ a: 0, b: 0 });
  const tickRef = useRef(null);
  const beatRef = useRef(null);
  const cvRef = useRef(null);

  const recount = useCallback(() => {
    let a = 0, b = 0;
    votesRef.current.forEach((v) => { if (v === "a") a++; else if (v === "b") b++; });
    countRef.current = { a, b };
    setCounts({ a, b });
  }, []);

  const publish = useCallback((patch) => {
    const next = { ...snapRef.current, ...patch };
    snapRef.current = next;
    liveRef.current = { sessionId: next.sessionId, round: next.round, status: next.status };
    setSnap(next);
    channelRef.current?.send({ type: "broadcast", event: "state", payload: next });
  }, []);

  // ── Live channel ────────────────────────────────────────
  useEffect(() => {
    setVoteUrl(`${window.location.origin}/band-of-heroes/vote`);
    let client;
    try {
      client = getLiveClient();
    } catch {
      return; // no Supabase env -> presenter still runs the show offline
    }
    const ch = client.channel(BOH_CHANNEL);
    channelRef.current = ch;

    ch.on("broadcast", { event: "vote" }, ({ payload }) => {
      const live = liveRef.current;
      if (!payload || live.status !== "open") return;
      if (payload.sessionId !== live.sessionId || payload.round !== live.round) return;
      if (payload.choice !== "a" && payload.choice !== "b") return;
      votesRef.current.set(payload.deviceId, payload.choice);
      recount();
    });
    ch.on("broadcast", { event: "hello" }, () => {
      ch.send({ type: "broadcast", event: "state", payload: snapRef.current });
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        publish({ sessionId: newSessionId(), round: 0, status: "standby", optionA: null, optionB: null, winner: null });
        clearInterval(beatRef.current);
        beatRef.current = setInterval(() => {
          channelRef.current?.send({ type: "broadcast", event: "state", payload: snapRef.current });
        }, 2500);
      }
    });

    return () => {
      clearInterval(beatRef.current);
      clearInterval(tickRef.current);
      try { client.removeChannel(ch); } catch {}
    };
  }, [publish, recount]);

  // ── Slideshow navigation ────────────────────────────────
  const go = useCallback((id) => {
    setHistory((h) => [...h, current]);
    setCurrent(id);
  }, [current]);

  const advance = useCallback(() => {
    if (slide.choices || slide.end) return;
    go(slide.next ?? slide.id + 1);
  }, [slide, go]);

  const back = useCallback(() => {
    if (!history.length) return;
    setCurrent(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    // leaving a vote slide: drop any open vote
    if (snapRef.current.status !== "standby") {
      clearInterval(tickRef.current);
      setTimeLeft(null);
      publish({ status: "standby", round: 0, winner: null, optionA: null, optionB: null });
    }
  }, [history, publish]);

  // ── Voting ──────────────────────────────────────────────
  const openVote = useCallback(() => {
    if (!slide.choices) return;
    votesRef.current = new Map();
    countRef.current = { a: 0, b: 0 };
    setCounts({ a: 0, b: 0 });
    publish({
      round: slide.id, status: "open",
      optionA: slide.choices[0].label, optionB: slide.choices[1].label, winner: null
    });
    setTimeLeft(duration);
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t === null) return null;
        if (t <= 1) { clearInterval(tickRef.current); cvRef.current?.(); return 0; }
        return t - 1;
      });
    }, 1000);
  }, [slide, duration, publish]);

  const closeVote = useCallback((winnerOverride) => {
    clearInterval(tickRef.current);
    setTimeLeft(null);
    let w = winnerOverride || null;
    if (!w) {
      const { a, b } = countRef.current;
      w = a > b ? "a" : b > a ? "b" : null; // tie -> presenter decides
    }
    publish({ status: "closed", winner: w });
  }, [publish]);

  useEffect(() => { cvRef.current = closeVote; }, [closeVote]);

  const extend = useCallback(() => setTimeLeft((t) => (t === null ? null : t + 10)), []);

  const continueAfterVote = useCallback(() => {
    const w = snapRef.current.winner;
    if (!w) return;
    const target = slide.choices[w === "a" ? 0 : 1].target;
    publish({ status: "standby", round: 0, winner: null, optionA: null, optionB: null });
    go(target);
  }, [slide, go, publish]);

  const reset = useCallback(() => {
    clearInterval(tickRef.current);
    setTimeLeft(null);
    votesRef.current = new Map();
    countRef.current = { a: 0, b: 0 };
    setCounts({ a: 0, b: 0 });
    setHistory([]);
    setCurrent(1);
    publish({ sessionId: newSessionId(), round: 0, status: "standby", optionA: null, optionB: null, winner: null });
  }, [publish]);

  const goFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }, []);

  // ── Keyboard (driver) — advance only on narrative slides ─
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") {
        if (!isVote && !slide.end) { e.preventDefault(); advance(); }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back, isVote, slide]);

  const total = counts.a + counts.b;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const status = snap.status;
  const optionA = slide.choices?.[0]?.label;
  const optionB = slide.choices?.[1]?.label;
  const winnerLabel = snap.winner ? (snap.winner === "a" ? optionA : optionB) : null;

  return (
    <div className="boh-present">
      {/* top control strip */}
      <div className="boh-bar">
        <span className={`boh-livedot ${connected ? "is-live" : ""}`}>
          {connected ? "LIVE" : "OFFLINE"}
        </span>
        <span className="boh-bar-scene">{slide.scene}</span>
        <span className="boh-bar-spacer" />
        <label className="boh-bar-dur">
          Vote&nbsp;
          <input
            type="number" min={5} max={120} value={duration}
            onChange={(e) => setDuration(Math.max(5, Math.min(120, Number(e.target.value) || 20)))}
          />s
        </label>
        <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={reset}>Reset</button>
        <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={goFullscreen}>Fullscreen</button>
      </div>

      <div className="boh-present-main">
        {/* stage */}
        <div className={`boh-stage boh-stage--${slide.kind}`}>
          <div className="boh-text">{renderSlide(slide)}</div>

          {/* winner reveal overlay */}
          {isVote && status === "closed" && winnerLabel && (
            <div className="boh-reveal">
              <span className="boh-reveal-label">The people choose</span>
              <span className="boh-reveal-name">{winnerLabel}</span>
            </div>
          )}
        </div>

        {/* persistent QR */}
        {voteUrl && (
          <div className={`boh-qr ${isVote && status === "open" ? "is-big" : ""}`}>
            <QRCodeSVG value={voteUrl} size={isVote && status === "open" ? 220 : 120} bgColor="#f7f3e8" fgColor="#211609" />
            <span className="boh-qr-cap">Scan to vote</span>
          </div>
        )}
      </div>

      {/* contextual controls */}
      <div className="boh-present-controls">
        {!isVote && (
          <>
            <button className="boh-btn boh-btn--ghost" onClick={back} disabled={!history.length}>Back</button>
            {slide.end
              ? <button className="boh-btn boh-btn--primary" onClick={reset}>Restart</button>
              : <button className="boh-btn boh-btn--primary" onClick={advance}>Next ▶</button>}
          </>
        )}

        {isVote && status !== "open" && status !== "closed" && (
          <>
            <button className="boh-btn boh-btn--ghost" onClick={back} disabled={!history.length}>Back</button>
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
              <span className="boh-override">Override:&nbsp;
                <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={() => closeVote("a")}>{optionA}</button>
                <button className="boh-btn boh-btn--ghost boh-btn--sm" onClick={() => closeVote("b")}>{optionB}</button>
              </span>
            </div>
          </div>
        )}

        {isVote && status === "closed" && (
          <>
            {winnerLabel ? (
              <button className="boh-btn boh-btn--primary boh-btn--lg" onClick={continueAfterVote}>
                Play {winnerLabel} ▶
              </button>
            ) : (
              <span className="boh-tie">Tie — you decide:&nbsp;
                <button className="boh-btn boh-btn--primary boh-btn--sm" onClick={() => closeVote("a")}>{optionA}</button>
                <button className="boh-btn boh-btn--primary boh-btn--sm" onClick={() => closeVote("b")}>{optionB}</button>
              </span>
            )}
            <button className="boh-btn boh-btn--ghost" onClick={back} disabled={!history.length}>Back</button>
          </>
        )}
      </div>
    </div>
  );
}
