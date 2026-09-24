import { NOTES_CHART_GEOMETRY as G, notesChartSummary } from "@/lib/carnegieLetters.mjs";

// "Fill my Music Notes" chart (#106): two beamed eighth notes made of 62 $5 and $10 squares.
// Filled squares come only from confirmed Carnegie gifts credited to the student. `blank` draws
// the empty chart for the printed packet, where supporters color in the notes they give.
const GARNET = "#4f101c";
const GOLD = "#c5a028";
const STAFF = "#e8d9a8";

function dollars(cents) {
  return `$${Math.round((Number(cents) || 0) / 100).toLocaleString("en-US")}`;
}

// Reported gifts that staff have not confirmed show as pending: an outlined, hatched square that
// is visibly different from a filled one. They count nowhere until confirmed.
export default function NotesChart({ confirmedCents = 0, pendingCents = 0, blank = false, className = "", title = "" }) {
  const summary = notesChartSummary(blank ? 0 : confirmedCents, blank ? 0 : pendingCents);
  const pendingText = summary.pendingCount ? ` ${summary.pendingCount} more waiting for staff to confirm.` : "";
  const label = title || (blank
    ? "Music notes chart: 62 notes of $5 and $10, $500 in all."
    : `${dollars(confirmedCents)} of $500 in music notes. ${summary.filledCount} of ${summary.total} notes filled.${pendingText}`);
  const { beam } = G;
  return (
    <svg className={className} viewBox={`0 0 ${G.width} ${G.height}`} role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      {summary.pendingCount ? (
        <defs>
          <pattern id="notes-pending-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#fff8e1" />
            <rect width="3" height="8" fill="#e9cf7a" />
          </pattern>
        </defs>
      ) : null}
      {G.staffLines.map((y) => <rect key={y} x="0" y={y} width={G.width} height="2" fill={STAFF} />)}
      <rect x={beam.x} y={beam.y} width={beam.width} height={beam.height} rx="10" fill={GARNET}
        transform={`translate(${beam.x} ${beam.y}) skewY(${beam.skewDeg}) translate(${-beam.x} ${-beam.y})`} />
      {G.stems.map((stem) => <rect key={stem.x} x={stem.x} y={stem.y} width={stem.width} height={stem.height} rx="8" fill={GARNET} />)}
      {G.heads.map((head) => (
        <ellipse key={head.id} cx={head.cx} cy={head.cy} rx={G.headRadius.rx} ry={G.headRadius.ry} fill={GARNET}
          transform={`rotate(${G.headRotateDeg} ${head.cx} ${head.cy})`} />
      ))}
      {summary.squares.map((square) => {
        const head = G.heads.find((item) => item.id === square.group);
        const pending = square.state === "pending";
        const fill = square.filled ? GOLD : pending ? "url(#notes-pending-hatch)" : "#ffffff";
        const ink = square.filled ? "#2b1a05" : GARNET;
        return (
          <g key={square.index} transform={head ? `rotate(${G.headRotateDeg} ${head.cx} ${head.cy})` : undefined}>
            <rect x={square.x} y={square.y} width={square.width} height={square.height} rx="5" fill={fill}
              {...(pending ? { stroke: GOLD, strokeWidth: 3, strokeDasharray: "5 3" } : {})} />
            <text x={square.x + square.width / 2} y={square.y + square.height / 2} textAnchor="middle" dominantBaseline="central"
              fontFamily="Inter, Arial, sans-serif" fontWeight="700" fontSize={head ? 15 : 16} fill={ink}>
              ${square.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
