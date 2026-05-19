"use client";

export default function RaceTrack({ players, winScore, currentPlayerId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="staff-sprint-track">
      {sorted.map((p) => {
        const pct = Math.min(100, Math.round((p.score / winScore) * 100));
        const isMe = p.id === currentPlayerId;
        return (
          <div key={p.id} className={`ss-lane ${isMe ? "ss-lane--me" : ""}`}>
            <div className="ss-lane-label">
              <span className="ss-lane-name">{p.display_name}{isMe ? " (you)" : ""}</span>
              <span className="ss-lane-score">{p.score}/{winScore}</span>
            </div>
            <div className="ss-lane-bar">
              <div className="ss-lane-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
