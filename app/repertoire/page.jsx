import { repertoire } from "./repertoireData";

export const metadata = {
  title: "Performed Repertoire | Bands of AHS",
  description: "A public archive of pieces performed by the Bands of Ashley High School."
};

function getYear(date) {
  const match = date.match(/\b(20\d{2})\b/);
  return match ? match[1] : "Undated";
}

function formatComposer(piece) {
  const credits = [];
  if (piece.composer) credits.push(piece.composer);
  if (piece.arranger) credits.push(`arr. ${piece.arranger}`);
  return credits.join(" · ");
}

export default function RepertoirePage() {
  const piecesByYear = repertoire.reduce((groups, piece) => {
    const year = getYear(piece.date);
    groups[year] ||= [];
    groups[year].push(piece);
    return groups;
  }, {});

  const years = Object.keys(piecesByYear).sort((a, b) => Number(b) - Number(a));

  return (
    <main className="repertoire-page">
      <section className="narrow-page repertoire-intro">
        <p className="eyebrow">Archive</p>
        <h1>Performed Repertoire</h1>
        <p className="lede">
          A public record of pieces performed by the Bands of Ashley High School.
        </p>
        <p className="archive-note">
          This list is maintained from the program repertoire archive and will continue to grow as
          future concerts are added.
        </p>
      </section>

      <section className="repertoire-list">
        {years.map((year) => (
          <section className="repertoire-year" key={year}>
            <h2>{year}</h2>
            <div className="repertoire-table-wrap">
              <table className="repertoire-table">
                <thead>
                  <tr>
                    <th>Piece</th>
                    <th>Composer / Arranger</th>
                    <th>Event</th>
                    <th>Ensemble</th>
                  </tr>
                </thead>
                <tbody>
                  {piecesByYear[year].map((piece, index) => (
                    <tr key={`${piece.title}-${piece.date}-${piece.ensemble}-${index}`}>
                      <td>
                        <strong>{piece.title}</strong>
                        {piece.notes ? <span className="table-note">{piece.notes}</span> : null}
                      </td>
                      <td>{formatComposer(piece) || "Traditional / not listed"}</td>
                      <td>
                        {piece.cycle}
                        <span className="table-note">{piece.date}</span>
                      </td>
                      <td>{piece.ensemble}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
