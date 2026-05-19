"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { MODES } from "@/lib/staffSprint/notes";
import { getStaffSprintClient } from "@/lib/staffSprint/client";
import "../staff-sprint.css";

export default function TeacherDashboard() {
  const [mode, setMode] = useState("treble_beginner");
  const [raceSize, setRaceSize] = useState(6);
  const [winScore, setWinScore] = useState(20);
  const [session, setSession] = useState(null);
  const [races, setRaces] = useState([]);
  const [players, setPlayers] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const joinUrl = useMemo(() => {
    if (!session) return "";
    if (typeof window === "undefined") return `/staff-sprint/play/${session.code}`;
    return `${window.location.origin}/staff-sprint/play/${session.code}`;
  }, [session]);

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 280, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [joinUrl]);

  // Subscribe to session realtime
  useEffect(() => {
    if (!session) return;
    const supabase = getStaffSprintClient();

    async function load() {
      const [r, p] = await Promise.all([
        supabase.from("staff_sprint_races").select("*").eq("session_id", session.id).order("race_number"),
        supabase.from("staff_sprint_players").select("*").eq("session_id", session.id)
      ]);
      if (r.data) setRaces(r.data);
      if (p.data) setPlayers(p.data);
    }
    load();

    const channel = supabase
      .channel(`teacher-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_sprint_races", filter: `session_id=eq.${session.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_sprint_players", filter: `session_id=eq.${session.id}` }, load)
      .subscribe();

    const stallTimer = setInterval(() => {
      fetch("/api/staff-sprint/start-stalled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id, min_players: 2, grace_seconds: 20 })
      }).catch(() => {});
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(stallTimer);
    };
  }, [session]);

  async function createSession(event) {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      const res = await fetch("/api/staff-sprint/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, race_size: raceSize, win_score: winScore })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create session");
      setSession(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (!session) {
    return (
      <main className="staff-sprint-page">
        <p className="eyebrow">Ashley Bands</p>
        <h1>Staff Sprint — Teacher</h1>
        <section className="ss-card">
          <form onSubmit={createSession}>
            <label className="ss-field">
              <span>Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="ss-field">
              <span>Race size (players per race)</span>
              <select value={raceSize} onChange={(e) => setRaceSize(Number(e.target.value))}>
                {[2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="ss-field">
              <span>Win score (correct answers to win)</span>
              <select value={winScore} onChange={(e) => setWinScore(Number(e.target.value))}>
                {[5,10,15,20,25,30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {error && <div className="ss-error">{error}</div>}
            <button type="submit" className="ss-btn ss-btn--primary" disabled={creating}>
              {creating ? "Creating…" : "Create session"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const playersByRace = new Map();
  for (const p of players) {
    const key = p.race_id || "unassigned";
    if (!playersByRace.has(key)) playersByRace.set(key, []);
    playersByRace.get(key).push(p);
  }

  return (
    <main className="staff-sprint-page">
      <p className="eyebrow">Staff Sprint Session</p>
      <h1>Code: {session.code}</h1>
      <p className="ss-muted">
        Students go to <strong>{joinUrl.replace(/^https?:\/\//, "")}</strong> or scan the QR.
      </p>

      <section className="ss-card">
        <div className="ss-code">{session.code}</div>
        {qrDataUrl && (
          <div className="ss-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Join QR code" width={280} height={280} />
          </div>
        )}
      </section>

      <section className="ss-card">
        <h2 style={{ marginTop: 0 }}>Races</h2>
        <p className="ss-muted">{players.length} students joined · {races.length} races · win at {session.win_score}</p>
        {races.length === 0 && <p>Waiting for students to join…</p>}
        <div className="ss-status-grid">
          {races.map((r) => {
            const racePlayers = playersByRace.get(r.id) || [];
            return (
              <div key={r.id} className="ss-status-card">
                <h3>Race {r.race_number}</h3>
                <span className={`ss-status-badge ss-status-badge--${r.status}`}>{r.status}</span>
                <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
                  {racePlayers.length === 0 && <div className="ss-muted">empty</div>}
                  {racePlayers.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{p.display_name}</span>
                      <span className="ss-muted">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
