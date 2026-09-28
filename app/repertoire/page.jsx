import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
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

  const columns = [
    { key: "piece", label: "Piece", rowHeader: true },
    { key: "composer", label: "Composer / Arranger" },
    { key: "event", label: "Event" },
    { key: "ensemble", label: "Ensemble" }
  ];

  return (
    <main className="repertoire-page">
      <PageHeader
        className="narrow-page repertoire-intro"
        eyebrow="Archive"
        title="Performed Repertoire"
        lede="A public record of pieces performed by the Bands of Ashley High School."
      >
        <p className="archive-note">
          This list is maintained from the program repertoire archive and will continue to grow as
          future concerts are added.
        </p>
      </PageHeader>

      <section className="repertoire-list">
        {years.map((year) => (
          <section className="repertoire-year" key={year}>
            <h2>{year}</h2>
            <DataTable
              className="repertoire-table-wrap"
              label={`Pieces performed in ${year}`}
              columns={columns}
              rowKey={(row) => row.key}
              rows={piecesByYear[year].map((piece, index) => ({
                key: `${piece.title}-${piece.date}-${piece.ensemble}-${index}`,
                piece: (
                  <>
                    {piece.title}
                    {piece.notes ? <span className="table-note">{piece.notes}</span> : null}
                  </>
                ),
                composer: formatComposer(piece) || "Traditional / not listed",
                event: (
                  <>
                    {piece.cycle}
                    <span className="table-note">{piece.date}</span>
                  </>
                ),
                ensemble: piece.ensemble
              }))}
            />
          </section>
        ))}
      </section>
    </main>
  );
}
