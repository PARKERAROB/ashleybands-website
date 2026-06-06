export const metadata = {
  title: "2026 Marching Band Sign-Up - Closed"
};

export default function MarchingBandSignupPage() {
  return (
    <main className="signup-page">
      <section className="signup-intro">
        <p className="eyebrow">Ashley Bands</p>
        <h1>2026 Marching Band Sign-Up</h1>
        <div
          className="signup-deadline"
          style={{ background: "#7a1f1f", color: "#fff" }}
        >
          This form is closed
        </div>
        <p>
          Sign-up for the 2026 marching band season is closed. This form is no
          longer accepting submissions.
        </p>
        <p>
          If you still have a question about marching band, please reach out to
          Mr. Parker directly.
        </p>
      </section>
    </main>
  );
}
