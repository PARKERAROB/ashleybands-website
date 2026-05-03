export const metadata = {
  title: "Spring Concert 2026 Program | Bands of AHS",
  description: "Archived digital program for the Ashley High School Bands 2026 Spring Concert."
};

export default function SpringConcert2026ProgramPage() {
  return (
    <main className="program-archive-page">
      <section className="program-archive-header">
        <p className="eyebrow">Archived Program</p>
        <h1>Spring Concert 2026</h1>
        <p>
          This is the digital program for the Ashley High School Bands Spring Concert on May 12, 2026.
        </p>
        <a className="text-link" href="/programs/spring-concert-2026/index.html">
          Open full-screen program
        </a>
      </section>

      <iframe
        className="program-frame"
        src="/programs/spring-concert-2026/index.html"
        title="Spring Concert 2026 digital program"
      />
    </main>
  );
}
