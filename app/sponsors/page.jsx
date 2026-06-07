import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  SPONSOR_CONTACT,
  TIERS,
  ADOPT_BANDS,
  ADOPT_PACKAGE_INCLUDES,
  ADOPT_SOLE_SPONSOR_BENEFITS,
  WHAT_SPONSORSHIP_FUNDS,
  MULTI_YEAR_DISCOUNT_NOTE,
  TAX_LANGUAGE_SHORT
} from "@/lib/sponsorshipContent";

export const metadata = {
  title: "Sponsor the Bands of Ashley | Bands of AHS",
  description:
    "Become a Screaming Eagle Sponsor. Tier sponsorships and Adopt-an-Instrument capital giving for the Bands of Ashley High School."
};

// Sponsors auto-publish here the day a gift is confirmed (build-spec §6 Lane A.2). Reads the
// walled sponsor_public_listing view (names + tier only). Resilient: any error or a dark
// funnel just hides the section. ISR-cached so the page stays fast.
export const revalidate = 300;

async function fetchListedSponsors() {
  try {
    const { data, error } = await supabaseAdmin
      .from("sponsor_public_listing")
      .select("gift_id, name_display, tier, gift_year")
      .order("name_display", { ascending: true });
    if (error || !data) return [];
    const seen = new Set();
    const names = [];
    for (const row of data) {
      const key = (row.name_display || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(row.name_display.trim());
    }
    return names;
  } catch {
    return [];
  }
}

export default async function SponsorsHubPage() {
  const sponsors = await fetchListedSponsors();
  return (
    <main className="sponsors-page">
      <section className="sponsors-hero">
        <p className="eyebrow">Support the Bands of Ashley High School</p>
        <h1>Become a Screaming Eagle Sponsor</h1>
        <p className="sponsors-lede">
          Local business sponsors fund the staff, transportation, scholarships, and instruments
          that make a serious public-school band program possible. Two ways to give. Both build
          the program for the long run.
        </p>
        <div className="sponsors-cta-row">
          <Link href="/sponsors/give" className="sponsors-btn sponsors-btn-primary">
            Give now
          </Link>
          <a href="#tiers" className="sponsors-btn">
            See sponsorship levels
          </a>
          <a href={`mailto:${SPONSOR_CONTACT.email}`} className="sponsors-btn">
            Contact Mr. Parker
          </a>
          <Link href="/sponsors/print/packet" className="sponsors-btn">
            Print the full packet
          </Link>
        </div>
      </section>

      {sponsors.length ? (
        <section className="sponsors-section" id="our-sponsors">
          <p className="eyebrow">Thank you</p>
          <h2>Our Sponsors</h2>
          <p>
            These businesses are funding the Bands of Ashley. When you support them, you support our students.
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 10
            }}
          >
            {sponsors.map((name) => (
              <li
                key={name}
                style={{
                  border: "1px solid #ece3d6",
                  borderRadius: 18,
                  padding: "8px 16px",
                  fontWeight: 600
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="sponsors-section" id="tiers">
        <p className="eyebrow">Path 1</p>
        <h2>Tier Sponsorship</h2>
        <p>
          Annual support for program operations and student scholarships. A portion of every
          tier sponsorship feeds the scholarship pool that covers marching band season fees and
          trip costs for students whose families need help. {MULTI_YEAR_DISCOUNT_NOTE}
        </p>
        <div className="tier-grid">
          {TIERS.map((tier) => (
            <article key={tier.name} className={`tier-card${tier.best ? " tier-card-best" : ""}`}>
              {tier.best && <span className="tier-tag">{tier.tag}</span>}
              <h3>{tier.name}</h3>
              <p className="tier-amount">{tier.label}</p>
              <ul>
                {tier.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">Path 2</p>
        <h2>Adopt-an-Instrument</h2>
        <p>
          The 10-year capital track toward the 2036 vision: every student in the Ashley band
          program with the option of using a quality Yamaha instrument. Gifts of $2,500 or more
          enter the year's instrument capital fund. Sole sponsors of a single instrument receive
          a brass plaque on the case for the life of the instrument.
        </p>

        <h3 className="sponsors-subhead">A complete instrument package includes</h3>
        <ul>
          {ADOPT_PACKAGE_INCLUDES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h3 className="sponsors-subhead">Sole sponsor of a single instrument receives</h3>
        <ul>
          {ADOPT_SOLE_SPONSOR_BENEFITS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <h3 className="sponsors-subhead">Package menu</h3>
        {ADOPT_BANDS.map((band) => (
          <div key={band.name} className="adopt-band">
            <h4>
              {band.name} — {band.range}
            </h4>
            <p className="adopt-band-typical">{band.typical}</p>
            <table className="adopt-table">
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
        <p className="adopt-note">
          Prices marked with ~ are estimates and will be confirmed in writing before any
          sole-sponsor commitment is finalized. Concert tubas and percussion are excluded from
          this menu.
        </p>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">What your sponsorship funds</p>
        <h2>The work, concretely</h2>
        <ul>
          {WHAT_SPONSORSHIP_FUNDS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="sponsors-section">
        <p className="eyebrow">Tax-deductibility</p>
        <h2>501(c)(3) information</h2>
        <p>{TAX_LANGUAGE_SHORT}</p>
      </section>

      <section className="sponsors-section sponsors-contact">
        <p className="eyebrow">Next step</p>
        <h2>Contact the director directly</h2>
        <p>
          To sponsor, talk through which path fits your business, or request the
          instrument-by-instrument package menu:
        </p>
        <p className="sponsors-contact-block">
          <strong>{SPONSOR_CONTACT.director}</strong> — {SPONSOR_CONTACT.title}
          <br />
          {SPONSOR_CONTACT.school}
          <br />
          <a href={`mailto:${SPONSOR_CONTACT.email}`}>{SPONSOR_CONTACT.email}</a>
          <br />
          {SPONSOR_CONTACT.phone}
        </p>
      </section>

      <footer className="sponsors-footer">
        <p>
          Band family running outreach? →{" "}
          <Link href="/sponsors/campaign">Open the family campaign tools</Link>
        </p>
        <p className="sponsors-footer-staff">
          <Link href="/sponsors/dashboard">Staff dashboard</Link>
        </p>
      </footer>
    </main>
  );
}
