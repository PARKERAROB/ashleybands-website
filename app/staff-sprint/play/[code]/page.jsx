"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import StaffNote from "@/components/staffSprint/StaffNote";
import AnswerButtons from "@/components/staffSprint/AnswerButtons";
import RaceTrack from "@/components/staffSprint/RaceTrack";
import ResultsScreen from "@/components/staffSprint/ResultsScreen";
import { pickNote } from "@/lib/staffSprint/notes";
import { getStaffSprintClient } from "@/lib/staffSprint/client";
import "../../staff-sprint.css";

const LOCKOUT_MS = 1000;

export default function PlayPage({ params }) {
  const { code } = use(params);
  const [phase, setPhase] = useState("join"); // join | lobby | racing | finished
  const [displayName, setDisplayName] = useState("");
  const [period, setPeriod] = useState("");
  const [instrument, setInstrument] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const [playerId, setPlayerId] = useState(null);
  const [raceId, setRaceId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessionRow, setSessionRow] = useState(null);
  const [raceRow, setRaceRow] = useState(null);
  const [players, setPlayers] = useState([]);

  const [note, setNote] = useState(null);
  const [locked, setLocked] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const lastKeyRef = useRef(null);

  function fetchNextNote(mode) {
    const next = pickNote(mode, lastKeyRef.current);
    lastKeyRef.current = next.keys[0];
    setNote(next);
  }

  async function join(event) {
    event.preventDefault();
    setError("");
    if (!displayName.trim()) {
      setError("Enter your name.");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch("/api/staff-sprint/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          display_name: displayName.trim(),
          instrument: instrument.trim(),
          period: period.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join.");
      setPlayerId(data.player_id);
      setRaceId(data.race_id);
      setSessionId(data.session_id);
      setPhase("lobby");
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  // Realtime subscription once joined
  useEffect(() => {
    if (!sessionId || !raceId) return;
    const supabase = getStaffSprintClient();

    (async () => {
      const [s, r, p] = await Promise.all([
        supabase.from("staff_sprint_sessions").select("*").eq("id", sessionId).single(),
        supabase.from("staff_sprint_races").select("*").eq("id", raceId).single(),
        supabase.from("staff_sprint_players").select("*").eq("race_id", raceId)
      ]);
      if (s.data) setSessionRow(s.data);
      if (r.data) setRaceRow(r.data);
      if (p.data) setPlayers(p.data);
    })();

    const channel = supabase
      .channel(`play-${raceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "staff_sprint_races", filter: `id=eq.${raceId}` },
        (payload) => { if (payload.new) setRaceRow(payload.new); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_sprint_players", filter: `race_id=eq.${raceId}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((p) => p.id !== payload.old?.id);
            }
            const row = payload.new;
            if (!row) return prev;
            const idx = prev.findIndex((p) => p.id === row.id);
            if (idx === -1) return [...prev, row];
            const next = prev.slice();
            next[idx] = row;
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, raceId]);

  // Phase transitions driven by raceRow.status
  useEffect(() => {
    if (!raceRow || !sessionRow) return;
    if (raceRow.status === "active" && phase !== "racing" && phase !== "finished") {
      setPhase("racing");
      fetchNextNote(sessionRow.mode);
    } else if (raceRow.status === "finished" && phase !== "finished") {
      setPhase("finished");
    }
  }, [raceRow, sessionRow, phase]);

  const submitAnswer = useCallback(async (letter) => {
    if (locked || !note) return;
    const isCorrect = letter === note.letter;
    setLocked(true);
    setLastResult({ picked: letter, actual: note.letter, correct: isCorrect });

    try {
      const res = await fetch("/api/staff-sprint/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId, is_correct: isCorrect })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.race_status === "finished") {
        // realtime will pick up; just wait for finished phase
      }
    } catch {}

    if (isCorrect) {
      // Brief flash, then next note
      setTimeout(() => {
        setLastResult(null);
        setLocked(false);
        if (sessionRow) fetchNextNote(sessionRow.mode);
      }, 250);
    } else {
      setTimeout(() => {
        setLastResult(null);
        setLocked(false);
        if (sessionRow) fetchNextNote(sessionRow.mode);
      }, LOCKOUT_MS);
    }
  }, [locked, note, playerId, sessionRow]);

  async function replay() {
    setReplaying(true);
    try {
      const res = await fetch("/api/staff-sprint/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not rejoin");
      setRaceId(data.new_race_id);
      setRaceRow(null);
      setPlayers([]);
      setNote(null);
      lastKeyRef.current = null;
      setPhase("lobby");
    } catch (err) {
      setError(err.message);
    } finally {
      setReplaying(false);
    }
  }

  const me = useMemo(() => players.find((p) => p.id === playerId), [players, playerId]);

  if (phase === "join") {
    return (
      <main className="staff-sprint-page">
        <p className="eyebrow">Staff Sprint · Code {code}</p>
        <h1>Join the race</h1>
        <section className="ss-card">
          <form onSubmit={join}>
            <label className="ss-field">
              <span>Your name (first + last initial)</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ava M."
                maxLength={40}
                autoFocus
              />
            </label>
            <label className="ss-field">
              <span>Period</span>
              <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2" maxLength={10} />
            </label>
            <label className="ss-field">
              <span>Instrument</span>
              <input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="Flute" maxLength={40} />
            </label>
            {error && <div className="ss-error">{error}</div>}
            <button type="submit" className="ss-btn ss-btn--primary" disabled={joining}>
              {joining ? "Joining…" : "Join race"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (phase === "lobby") {
    const waiting = players.length;
    const target = sessionRow?.race_size || "?";
    return (
      <main className="staff-sprint-page">
        <p className="eyebrow">Staff Sprint · Code {code}</p>
        <h1>Waiting for racers…</h1>
        <section className="ss-card">
          <p className="ss-muted" style={{ marginTop: 0 }}>
            {waiting}/{target} in this race. Starts when full, or after a short wait.
          </p>
          <ul style={{ paddingLeft: "1.25rem" }}>
            {players.map((p) => (
              <li key={p.id}>{p.display_name}{p.id === playerId ? " (you)" : ""}</li>
            ))}
          </ul>
        </section>
      </main>
    );
  }

  if (phase === "racing") {
    return (
      <main className="staff-sprint-page">
        <p className="eyebrow">Staff Sprint · Race {raceRow?.race_number}</p>
        <h1>Name the note</h1>
        <section className="ss-card">
          {note && <StaffNote note={note} />}
          <AnswerButtons onAnswer={submitAnswer} disabled={locked} lastResult={lastResult} />
        </section>
        <section className="ss-card">
          <RaceTrack players={players} winScore={sessionRow?.win_score || 20} currentPlayerId={playerId} />
        </section>
      </main>
    );
  }

  return (
    <main className="staff-sprint-page">
      <p className="eyebrow">Staff Sprint · Race {raceRow?.race_number}</p>
      <section className="ss-card">
        <ResultsScreen
          players={players}
          currentPlayerId={playerId}
          onReplay={replay}
          replaying={replaying}
        />
        {error && <div className="ss-error">{error}</div>}
        {me && (
          <p className="ss-muted" style={{ marginTop: "1rem" }}>
            You answered {me.score} correct, {me.incorrect} wrong.
          </p>
        )}
      </section>
    </main>
  );
}
