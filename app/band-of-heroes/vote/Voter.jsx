"use client";

// Band of Heroes — voter view (audience phones).
// Mirrors the presenter: stand-by between votes, two big buttons when a vote is
// open, the winner when it closes. One vote per device, changeable until close.

import { useEffect, useRef, useState } from "react";
import { getLiveClient, getDeviceId, BOH_CHANNEL } from "@/lib/bandOfHeroes/live";

export default function Voter() {
  const [snap, setSnap] = useState(null); // { sessionId, round, status, optionA, optionB, winner }
  const [myChoice, setMyChoice] = useState(null);
  const [phase, setPhase] = useState("connecting"); // connecting | live | noenv

  const channelRef = useRef(null);
  const deviceRef = useRef(null);
  const keyRef = useRef(null); // `${sessionId}:${round}` to reset choice per vote

  useEffect(() => {
    deviceRef.current = getDeviceId();
    let client;
    try {
      client = getLiveClient();
    } catch {
      setPhase("noenv");
      return;
    }
    const ch = client.channel(BOH_CHANNEL);
    channelRef.current = ch;

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (!payload) return;
      const key = `${payload.sessionId}:${payload.round}`;
      if (key !== keyRef.current) {
        keyRef.current = key;
        setMyChoice(null); // new vote (or new session) -> clear my pick
      }
      setSnap(payload);
      setPhase("live");
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "hello", payload: { deviceId: deviceRef.current } });
      }
    });

    return () => { try { client.removeChannel(ch); } catch {} };
  }, []);

  function vote(choice) {
    if (!snap || snap.status !== "open") return;
    setMyChoice(choice);
    channelRef.current?.send({
      type: "broadcast",
      event: "vote",
      payload: { sessionId: snap.sessionId, round: snap.round, deviceId: deviceRef.current, choice }
    });
  }

  if (phase === "noenv") {
    return (
      <main className="boh-voter">
        <div className="boh-voter-inner">
          <p className="boh-voter-msg">Voting is not available right now.</p>
        </div>
      </main>
    );
  }

  const status = snap?.status;
  const open = status === "open";
  const closed = status === "closed";
  const winnerLabel = snap?.winner ? (snap.winner === "a" ? snap.optionA : snap.optionB) : null;

  return (
    <main className="boh-voter">
      <div className="boh-voter-inner">
        <p className="boh-voter-title">Band of Heroes</p>

        {open ? (
          <>
            <p className="boh-voter-prompt">Tap your choice</p>
            <div className="boh-voter-choices">
              <button
                className={`boh-voter-btn ${myChoice === "a" ? "is-mine" : ""}`}
                onClick={() => vote("a")}
              >
                {snap.optionA}
              </button>
              <button
                className={`boh-voter-btn ${myChoice === "b" ? "is-mine" : ""}`}
                onClick={() => vote("b")}
              >
                {snap.optionB}
              </button>
            </div>
            <p className="boh-voter-note">
              {myChoice
                ? `You chose: ${myChoice === "a" ? snap.optionA : snap.optionB} — tap to change`
                : "One vote per phone. You can change it until voting closes."}
            </p>
          </>
        ) : closed && winnerLabel ? (
          <>
            <p className="boh-voter-prompt">The people choose</p>
            <p className="boh-voter-winner">{winnerLabel}</p>
            <p className="boh-voter-note">Stand by for the next choice…</p>
          </>
        ) : (
          <>
            <p className="boh-voter-prompt">
              {phase === "connecting" ? "Connecting…" : "Stand by for the next choice…"}
            </p>
            <p className="boh-voter-note">Keep this page open. Your choices will appear here.</p>
          </>
        )}
      </div>
    </main>
  );
}
