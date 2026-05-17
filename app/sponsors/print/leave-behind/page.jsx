import PrintControls from "@/components/PrintControls";
import {
  SPONSOR_CONTACT,
  TIERS,
  WHAT_SPONSORSHIP_FUNDS
} from "@/lib/sponsorshipContent";

export const metadata = {
  title: "Sponsorship Leave-Behind (Print) | Bands of AHS",
  robots: { index: false }
};

export default function PrintLeaveBehindPage() {
  return (
    <main className="print-page">
      <PrintControls />

      <article className="print-doc print-leave-behind">
        <header className="print-letterhead">
          <p className="print-org">The Bands of Ashley High School</p>
          <p className="print-eyebrow">2026-2027 Screaming Eagle Sponsor</p>
        </header>

        <h1 className="print-h1">Become a Screaming Eagle Sponsor</h1>

        <p className="print-lede">
          The county funds the basics. Local business sponsors fund the rest: instructional
          staff, transportation, show production, uniforms, scholarships that keep students on
          the field, and the instruments we're replacing over the next decade. By 2036, every
          student in the Ashley band program will have the option of using a quality Yamaha
          instrument. Your sponsorship is part of that ten-year build.
        </p>

        <h2 className="print-h2">Two ways to give</h2>

        <h3 className="print-h3">Tier Sponsorship — annual, supports operations</h3>
        <table className="print-table print-table-compact">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Amount</th>
              <th>Key benefits</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.name} className={t.best ? "print-row-best" : ""}>
                <td>
                  <strong>{t.name}</strong>
                  {t.best && <span className="print-tag"> · {t.tag}</span>}
                </td>
                <td>{t.label}</td>
                <td>{t.benefits.join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="print-small">3-year commitment: 10% off.</p>

        <h3 className="print-h3">Adopt-an-Instrument — capital, toward the 2036 vision</h3>
        <p>
          Gifts of $2,500 or more enter the year's instrument capital fund. Fund a complete
          instrument package and receive a brass plaque on the case with your name for the life
          of the instrument (typically 15 years), plus named recognition in the program every
          year that instrument is in service.
        </p>
        <p className="print-small">
          Example packages: Flute ≈ $2,550 · Bass Clarinet ≈ $4,080 · French Horn ≈ $6,593 ·
          Bari Sax ≈ $10,182 · Sousaphone ≈ $15,348. Full menu available on request.
        </p>

        <h2 className="print-h2">What your sponsorship funds</h2>
        <ul className="print-ul-tight">
          {WHAT_SPONSORSHIP_FUNDS.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <h2 className="print-h2">Tax-deductible</h2>
        <p className="print-small">
          {SPONSOR_CONTACT.boosterOrg} is a registered 501(c)(3). Federal Tax ID:{" "}
          {SPONSOR_CONTACT.ein}. Your written receipt confirms the deductible portion of your
          gift.
        </p>

        <h2 className="print-h2">Next step</h2>
        <p className="print-small">
          The family who handed you this packet has the sponsorship form and the full benefits
          matrix. You can also reach the director directly:
        </p>
        <p className="print-contact">
          <strong>{SPONSOR_CONTACT.director}</strong> — {SPONSOR_CONTACT.title}
          <br />
          {SPONSOR_CONTACT.school} · {SPONSOR_CONTACT.email}
          <br />
          {SPONSOR_CONTACT.sponsorsUrl}
        </p>
      </article>
    </main>
  );
}
