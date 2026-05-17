import PrintControls from "@/components/PrintControls";
import {
  SPONSOR_CONTACT,
  SPONSOR_LEAD,
  TIERS,
  ADOPT_BANDS,
  ADOPT_PACKAGE_INCLUDES,
  ADOPT_SOLE_SPONSOR_BENEFITS,
  COVER_LETTER_BODY,
  TAX_LANGUAGE_SHORT,
  TAX_LANGUAGE_FULL
} from "@/lib/sponsorshipContent";

export const metadata = {
  title: "Sponsorship Packet (Print) | Bands of AHS",
  robots: { index: false }
};

function paragraphWithBold(p, key) {
  const parts = p.split(/(\*\*[^*]+\*\*)/);
  return (
    <p key={key}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

export default function PrintPacketPage() {
  return (
    <main className="print-page">
      <PrintControls />

      <article className="print-doc">
        <header className="print-letterhead">
          <p className="print-org">The Bands of Ashley High School</p>
          <p className="print-address">
            {SPONSOR_CONTACT.address} · {SPONSOR_CONTACT.cityStateZip}
          </p>
          <p className="print-director">
            {SPONSOR_CONTACT.director}, {SPONSOR_CONTACT.title} · {SPONSOR_CONTACT.email}
          </p>
        </header>

        <h1 className="print-h1">Become a Screaming Eagle Sponsor</h1>
        <p className="print-greeting">Dear Community Leader,</p>
        <p>
          I am the Director of Bands at Eugene Ashley High School. I am writing to ask you to
          consider sponsoring our program for the 2026-2027 school year.
        </p>

        {COVER_LETTER_BODY.map((section) => (
          <section key={section.heading} className="print-section">
            <h2 className="print-h2">{section.heading}</h2>
            {section.paragraphs.map((p, i) => paragraphWithBold(p, `${section.heading}-${i}`))}
          </section>
        ))}

        <section className="print-section">
          <h2 className="print-h2">Tax information</h2>
          <p>{TAX_LANGUAGE_SHORT}</p>
        </section>

        <section className="print-section">
          <h2 className="print-h2">Next step</h2>
          <p>
            Review the attached materials. If you would like to talk through how a sponsorship
            would work for your business, please contact me directly.
          </p>
          <p>Thank you for your consideration. The students at Ashley High School and I are grateful for the community that makes this program possible.</p>
          <p className="print-signoff">
            Sincerely,
            <br />
            <br />
            {SPONSOR_CONTACT.director}
            <br />
            {SPONSOR_CONTACT.title}, {SPONSOR_CONTACT.school}
            <br />
            {SPONSOR_CONTACT.email}
          </p>
        </section>

        <div className="print-pagebreak" />

        <h1 className="print-h1">Sponsorship Levels &amp; Benefits</h1>

        <section className="print-section">
          <h2 className="print-h2">Path 1 — Tier Sponsorship</h2>
          <p>
            Annual operations + student scholarships. A $2,000 sponsorship can put four students
            on the field who otherwise would not be there.
          </p>
          <table className="print-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Amount</th>
                <th>What you get</th>
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
                  <td>
                    <ul className="print-ul-tight">
                      {t.benefits.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>Multi-year:</strong> 3-year tier commitment saves 10% per year.
          </p>
        </section>

        <div className="print-pagebreak" />

        <section className="print-section">
          <h2 className="print-h2">Path 2 — Adopt-an-Instrument</h2>
          <p>
            By 2036, our goal is for every student in the Ashley band program to have the option
            of using a quality Yamaha instrument. Gifts of $2,500 or more enter the year's
            instrument capital fund.
          </p>

          <h3 className="print-h3">A complete instrument package includes</h3>
          <ul>
            {ADOPT_PACKAGE_INCLUDES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3 className="print-h3">Sole sponsor of a single instrument receives</h3>
          <ul>
            {ADOPT_SOLE_SPONSOR_BENEFITS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          <h3 className="print-h3">Package menu</h3>
          {ADOPT_BANDS.map((band) => (
            <div key={band.name} className="print-adopt-band">
              <h4 className="print-h4">
                {band.name} — {band.range} · {band.typical}
              </h4>
              <table className="print-table print-table-compact">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Model</th>
                    <th>Package cost</th>
                  </tr>
                </thead>
                <tbody>
                  {band.examples.map((row) => (
                    <tr key={`${band.name}-${row.instrument}`}>
                      <td>{row.instrument}</td>
                      <td>{row.model}</td>
                      <td>{row.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="print-note">
            Prices are estimates and will be confirmed in writing before any sole-sponsor
            commitment is finalized. Concert tubas and percussion are excluded.
          </p>
        </section>

        <div className="print-pagebreak" />

        <h1 className="print-h1">Sponsorship Form — 2026-2027</h1>
        <p>
          <strong>{SPONSOR_CONTACT.boosterOrg}</strong> is a registered 501(c)(3) organization.
          Federal Tax ID: {SPONSOR_CONTACT.ein}.
        </p>

        <h2 className="print-h2">Sponsor information</h2>
        <table className="print-form-table">
          <tbody>
            <tr><td>Business or individual name (as you'd like it recognized)</td><td className="print-form-blank" /></tr>
            <tr><td>Contact name</td><td className="print-form-blank" /></tr>
            <tr><td>Address</td><td className="print-form-blank" /></tr>
            <tr><td>&nbsp;</td><td className="print-form-blank" /></tr>
            <tr><td>Phone</td><td className="print-form-blank" /></tr>
            <tr><td>Email</td><td className="print-form-blank" /></tr>
            <tr><td>Website (for sponsor listing)</td><td className="print-form-blank" /></tr>
            <tr><td>Social media handles (optional, for tagging)</td><td className="print-form-blank" /></tr>
          </tbody>
        </table>

        <h2 className="print-h2">Choose your sponsorship path</h2>
        <p><em>Select one. You may sponsor both paths in the same year by completing two forms.</em></p>

        <h3 className="print-h3">Path 1 — Tier Sponsorship</h3>
        <ul className="print-checklist">
          <li>☐ Friend — $250</li>
          <li>☐ Patron — $750</li>
          <li>☐ Premier — $1,500 ⭐ best value</li>
          <li>☐ Legacy — $3,000+ (specify amount: $__________)</li>
        </ul>
        <p>☐ Yes, I'd like to commit for 3 years at this tier (10% multi-year discount).</p>

        <h3 className="print-h3">Path 2 — Adopt-an-Instrument</h3>
        <ul className="print-checklist">
          <li>☐ Band 1 — $2,500 to $4,999 (specify: $__________)</li>
          <li>☐ Band 2 — $5,000 to $9,999 (specify: $__________)</li>
          <li>☐ Band 3 — $10,000+ (specify: $__________)</li>
        </ul>
        <p>Designation (optional): _______________________________________________</p>
        <p>
          <strong>Sole sponsor of a single instrument?</strong>
        </p>
        <ul className="print-checklist">
          <li>☐ I would like to be the sole sponsor of one instrument. (Please contact me with package costs for: ____________________)</li>
          <li>☐ My gift joins the year's pool. No plaque expected.</li>
        </ul>

        <h2 className="print-h2">Recognition</h2>
        <table className="print-form-table">
          <tbody>
            <tr><td>Recognition name (if different from above)</td><td className="print-form-blank" /></tr>
            <tr><td>Logo (☐ I will email a high-res file to {SPONSOR_LEAD.email})</td><td className="print-form-blank" /></tr>
          </tbody>
        </table>

        <h2 className="print-h2">Payment</h2>
        <ul className="print-checklist">
          <li>☐ Check enclosed (payable to <strong>{SPONSOR_CONTACT.boosterOrg}</strong>)</li>
          <li>☐ I'll pay online (link will be sent with confirmation)</li>
          <li>☐ Please contact me to discuss payment timing</li>
        </ul>

        <h2 className="print-h2">Tax-deductibility</h2>
        {TAX_LANGUAGE_FULL.map((p, i) => (
          <p key={`tax-${i}`}>{p}</p>
        ))}

        <h2 className="print-h2">Sign and return</h2>
        <table className="print-form-table">
          <tbody>
            <tr><td>Signature</td><td className="print-form-blank" /></tr>
            <tr><td>Date</td><td className="print-form-blank" /></tr>
          </tbody>
        </table>

        <p className="print-return">
          <strong>Return to:</strong>
          <br />
          {SPONSOR_CONTACT.boosterOrg} — Sponsorship
          <br />
          Attn: {SPONSOR_CONTACT.director}, {SPONSOR_CONTACT.title}
          <br />
          {SPONSOR_CONTACT.school}
          <br />
          {SPONSOR_CONTACT.address}
          <br />
          {SPONSOR_CONTACT.cityStateZip}
          <br />
          {SPONSOR_LEAD.email}
        </p>
        <p>You will receive a confirmation and tax receipt within two weeks of receipt of your gift.</p>
      </article>
    </main>
  );
}
