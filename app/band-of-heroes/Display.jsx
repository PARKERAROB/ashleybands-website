"use client";

// Band of Heroes — projected display (the big screen).
// A pure follower: it renders whatever the controller broadcasts (current slide,
// live tally, winner) and shows the persistent QR. No controls live here — Rob
// drives from /band-of-heroes/control on his phone.

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { byId, renderSlide } from "./slideView";
import { getLiveClient, BOH_CHANNEL } from "@/lib/bandOfHeroes/live";

const DEFAULT = { slideId: 1, status: "idle", optionA: null, optionB: null, counts: { a: 0, b: 0 }, winner: null };

export default function Display() {
  const [snap, setSnap] = useState(DEFAULT);
  const [voteUrl, setVoteUrl] = useState("");
  const channelRef = useRef(null);

  useEffect(() => {
    setVoteUrl(`${window.location.origin}/band-of-heroes/vote`);
    let client;
    try { client = getLiveClient(); } catch { return; }
    const ch = client.channel(BOH_CHANNEL);
    channelRef.current = ch;
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (payload && typeof payload.slideId === "number") setSnap(payload);
    });
    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") ch.send({ type: "broadcast", event: "hello", payload: { who: "display" } });
    });
    return () => { try { client.removeChannel(ch); } catch {} };
  }, []);

  const slide = byId.get(snap.slideId) || byId.get(1);
  const isVote = !!slide.choices;
  const status = snap.status;
  const counts = snap.counts || { a: 0, b: 0 };
  const total = counts.a + counts.b;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const winnerLabel = snap.winner ? (snap.winner === "a" ? snap.optionA : snap.optionB) : null;
  const voteOpen = isVote && status === "open";

  function goFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="boh-display">
      <button className="boh-fs" onClick={goFullscreen} title="Fullscreen">⛶</button>

      <div className="boh-display-main">
        <div className={`boh-stage boh-stage--${slide.kind} boh-stage--display`}>
          <div className="boh-text">{renderSlide(slide)}</div>

          {voteOpen && (
            <div className="boh-stage-tally">
              <div className="boh-tally-row">
                <span className="boh-tally-name">{snap.optionA}</span>
                <div className="boh-tally-track"><div className="boh-tally-fill boh-fill-a" style={{ width: `${pct(counts.a)}%` }} /></div>
                <span className="boh-tally-num">{counts.a}</span>
              </div>
              <div className="boh-tally-row">
                <span className="boh-tally-name">{snap.optionB}</span>
                <div className="boh-tally-track"><div className="boh-tally-fill boh-fill-b" style={{ width: `${pct(counts.b)}%` }} /></div>
                <span className="boh-tally-num">{counts.b}</span>
              </div>
            </div>
          )}

          {isVote && status === "closed" && winnerLabel && (
            <div className="boh-reveal">
              <span className="boh-reveal-label">The people choose</span>
              <span className="boh-reveal-name">{winnerLabel}</span>
            </div>
          )}
        </div>

        {voteUrl && (
          <div className={`boh-qr ${voteOpen ? "is-big" : ""}`}>
            <QRCodeSVG value={voteUrl} size={voteOpen ? 240 : 132} bgColor="#f7f3e8" fgColor="#211609" />
            <span className="boh-qr-cap">Scan to vote</span>
          </div>
        )}
      </div>
    </div>
  );
}
