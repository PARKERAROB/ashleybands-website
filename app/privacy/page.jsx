// DRAFT privacy notice — NOT linked from any nav. Reachable only by direct
// URL until Mr. Parker approves the real copy (see
// ~/Atlas/BandsofAHS/projects/placement-authority-2026-27/provenance-lane-map.md
// §4 item 6 / §6 "consent copy"). Swap the placeholder text below for the
// approved wording, then link it from the footer/sitemap and drop this notice.

export const metadata = {
  title: "Privacy Notice (Draft) | Bands of AHS",
  robots: { index: false, follow: false }
};

export default function PrivacyNoticePage() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">Draft — Not Yet Published</p>
      <h1>Privacy Notice</h1>
      <p
        className="lede"
        style={{
          background: "#fff3cd",
          border: "1px solid #f0c36d",
          borderRadius: "6px",
          padding: "0.75rem 1rem",
          color: "#664d03"
        }}
      >
        DRAFT — pending Mr. Parker&rsquo;s approval. This page is not linked anywhere on the site
        and is not final. Do not treat this text as the program&rsquo;s policy.
      </p>

      <h2>What this notice will cover</h2>
      <p>
        This placeholder marks where the approved privacy notice will live once Mr. Parker signs
        off on the wording. It will explain, in plain language:
      </p>
      <ul>
        <li>What family and student information the band program collects, and why.</li>
        <li>Where that information is stored, and who can see it.</li>
        <li>That the program collects no grades, GPA, or coursework data — ever.</li>
        <li>How families can review, correct, or ask questions about their information.</li>
        <li>How to reach Mr. Parker with a privacy question or concern.</li>
      </ul>

      <h2>Status</h2>
      <p>
        Placeholder copy only. The real notice is drafted separately and swapped in here once
        approved — nothing on this page is final policy.
      </p>
    </main>
  );
}
