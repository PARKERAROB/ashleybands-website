import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Notice from "@/components/ui/Notice";
import DataTable from "@/components/ui/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = {
  title: "Band Handbook | Bands of AHS",
  description: "Ashley High School Band Program Handbook"
};

// Mr. Parker's grading rules, Oct 2026 (#238). Replaces the PDF's 35/25/25/15 section.
const gradingColumns = [
  { key: "category", label: "Category", rowHeader: true },
  { key: "weight", label: "Weight", align: "end" },
  { key: "measures", label: "What it measures" }
];

const gradingRows = [
  {
    key: "performance-assessments",
    category: "Performance Assessments",
    weight: "40%",
    measures: "Individual playing: scales, assigned music, sight-reading and recordings. These reflect only your student."
  },
  {
    key: "performance-contribution",
    category: "Performance Contribution",
    weight: "20%",
    measures: "The required concerts: Fall Concert, Winter Concert, MPA and Spring Concert."
  },
  {
    key: "rehearsal-assessments",
    category: "Rehearsal Assessments",
    weight: "30%",
    measures: "Where the ensemble is on a given day, usually in the weeks before a performance."
  },
  {
    key: "rehearsal-contribution",
    category: "Rehearsal Contribution",
    weight: "10%",
    measures: "Attendance in rehearsal."
  }
];

export default function HandbookPage() {
  return (
    <main className="narrow-page policy-page">
      <PageHeader
        eyebrow="Students & Families"
        title="Band Handbook"
        lede="Program expectations, policies, and information for Ashley band members."
      />
      <Notice tone="info" title="This is the 2023-24 handbook.">
        <p>Its policies still apply, except grading: the current grading policy is below. Its dates, schedules and funding amounts do not apply.</p>
        <p>
          For current dates, use the <Link href="/calendar">Band Calendar</Link>. For this fall&apos;s
          marching band, see <Link href="/info/marching-band-2026">Marching Band 2026</Link>.
        </p>
      </Notice>

      <section aria-labelledby="grading">
        <h2 id="grading">Grading, 2026-27</h2>
        <p>
          Every band class follows the school&apos;s split: 60% performance and 40% practice. In band, practice
          means rehearsal. Each side has two parts.
        </p>
        <DataTable label="Band grade categories" columns={gradingColumns} rows={gradingRows} rowKey={(row) => row.key} />
        <h3>Rehearsal assessments</h3>
        <p>
          A rehearsal assessment is a snapshot of the ensemble, not a playing test. We rate the rehearsal with
          the same rating system judges use at MPA, and most often every student gets the same score. Mr. Parker
          adjusts a student&apos;s score when their own contribution clearly differs. That is rare, and it almost
          always lowers a score rather than raising it. Individual skill is graded in the performance assessments.
        </p>
        <h3>Quarter grades</h3>
        <p>
          Before every quarter grade, Mr. Parker reviews each student&apos;s grade to make sure it reflects their
          work in the class.
        </p>
      </section>

      <div className="handbook-pdf">
        <ButtonLink href="/handbook.pdf" variant="secondary" target="_blank" rel="noopener noreferrer">
          Download PDF
        </ButtonLink>
        <iframe src="/handbook.pdf" width="100%" height="900" className="handbook-frame" title="Band Handbook" />
      </div>
    </main>
  );
}
