import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = {
  title: "Program Archive | Bands of AHS",
  description: "Archived concert programs from the Bands of Ashley High School."
};

const programs = [
  {
    title: "Spring Concert 2026",
    date: "May 12, 2026",
    href: "/programs/spring-concert-2026",
    description: "Digital program for the 2026 Spring Concert."
  }
];

export default function ProgramsPage() {
  return (
    <main className="narrow-page">
      <PageHeader
        eyebrow="Archive"
        title="Concert Programs"
        lede="Digital programs are kept here as an archive of performances by the Bands of Ashley High School."
      />

      <div className="archive-list">
        {programs.map((program) => (
          <Link className="archive-item" href={program.href} key={program.href}>
            <span>{program.date}</span>
            <h2>{program.title}</h2>
            <p>{program.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
