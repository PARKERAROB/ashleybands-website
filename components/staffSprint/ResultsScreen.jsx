"use client";

export default function ResultsScreen({ players, currentPlayerId, onReplay, replaying }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const places = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
  return (
    <div className="staff-sprint-results">
      <h2>Race finished</h2>
      <ol className="ss-results-list">
        {sorted.map((p, i) => {
          const total = p.score + p.incorrect;
          const acc = total > 0 ? Math.round((p.score / total) * 100) : 0;
          return (
            <li key={p.id} className={p.id === currentPlayerId ? "ss-result--me" : ""}>
              <span className="ss-place">{places[i] || `${i + 1}th`}</span>
              <span className="ss-result-name">{p.display_name}</span>
              <span className="ss-result-stats">{p.score} correct · {acc}% accuracy</span>
            </li>
          );
        })}
      </ol>
      <button className="ss-btn ss-btn--primary" onClick={onReplay} disabled={replaying} type="button">
        {replaying ? "Joining next race…" : "Play again"}
      </button>
    </div>
  );
}
