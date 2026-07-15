export const metadata = {
  title: "2026 Marching Band Sign-Up | Ashley Bands"
};

export default function MarchingBandSignupPage() {
  return (
    <main className="signup-page">
      <section className="signup-intro">
        <p className="eyebrow">Ashley Bands</p>
        <h1>2026 Marching Band Sign-Up</h1>
        <p>Sign-up for the 2026 marching band season is closed.</p>
        <p>
          If your student is marching this season, your family portal is your home base for contact
          information and funding. All season dates, times, and locations live on the band calendar.
        </p>
        <div className="signup-next">
          <a href="/portal" className="sponsors-btn sponsors-btn-primary">Open your Family Portal</a>
          <a href="/calendar" className="sponsors-btn">View the Band Calendar</a>
        </div>
        <p>Questions? Email Mr. Parker at robert.parker@nhcs.net or call (910) 790-2360.</p>
      </section>
    </main>
  );
}
