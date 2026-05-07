export const metadata = {
  title: "Band Handbook | Bands of AHS",
  description: "Ashley High School Band Program Handbook"
};

export default function HandbookPage() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">Students &amp; Families</p>
      <h1>Band Handbook</h1>
      <p className="lede">Program expectations, policies, and information for Ashley band members.</p>
      <div style={{ marginTop: "1.5rem" }}>
        <a
          href="/handbook.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", marginBottom: "1.5rem", fontWeight: 600 }}
        >
          Download PDF
        </a>
        <iframe
          src="/handbook.pdf"
          width="100%"
          height="900"
          style={{ border: "1px solid #ddd", borderRadius: "6px", display: "block" }}
          title="Band Handbook"
        />
      </div>
    </main>
  );
}
