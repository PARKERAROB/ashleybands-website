import Link from "next/link";
import packet from "@/content/carnegie-2027-meeting-packet.json";
import styles from "./meeting-packet.module.css";

const PDF_PATH = "/downloads/carnegie-hall-2027-family-meeting-packet.pdf";

export const metadata = {
  title: "Carnegie Hall 2027 Family Meeting Packet | Ashley Bands",
  description: "Ashley Bands Carnegie Hall 2027 family meeting packet, including commitment, cost, cancellation, FRP, and next-step information.",
};

function Section({ eyebrow, title, children }) {
  return <section className={styles.section}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{children}</section>;
}

export default function CarnegieMeetingPacketPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Ashley Bands • Family information</p>
          <h1>{packet.title}</h1>
          <p className={styles.subtitle}>{packet.subtitle}</p>
          <p className={styles.summary}>{packet.summary}</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/carnegie-2027/commit">Complete the commitment</Link>
            <a className={styles.secondary} href={PDF_PATH} download>Download the PDF packet</a>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.anchorSection} aria-labelledby="numbers-heading">
          <p className={styles.eyebrow}>The numbers to remember</p>
          <h2 id="numbers-heading">One commitment, one ceiling, one shared goal</h2>
          <div className={styles.anchors}>
            {packet.anchors.map((item) => <article key={item.number}><strong>{item.number}</strong><h3>{item.label}</h3><p>{item.description}</p></article>)}
          </div>
          <p className={styles.planning}>{packet.planningFigure}</p>
        </section>

        <Section eyebrow="Who is responsible" title="Four names, four different roles">
          <div className={styles.roles}>{packet.roles.map((item) => <article key={item.actor}><h3>{item.actor}</h3><p>{item.responsibility}</p></article>)}</div>
        </Section>

        <Section eyebrow="The opportunity" title="Two Ashley High School ensembles were selected. Now the plan has to become real.">
          <ul>{packet.opportunity.map((item) => <li key={item}>{item}</li>)}</ul>
        </Section>

        <Section eyebrow="Participation" title="The trip can move forward in one of two ways">
          <div className={styles.paths}>{packet.participationPaths.map((path) => <article key={path.title}><strong>{path.number}</strong><h3>{path.title}</h3><ul>{path.details.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
        </Section>

        <Section eyebrow="What tonight means" title="Serious intent now; final contract next">
          <ul>{packet.commitment.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Working maximum</th><th>Meaning</th></tr></thead><tbody>{packet.paymentSchedule.map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.amount}</td><td>{row.meaning}</td></tr>)}</tbody></table></div>
          <p className={styles.note}>{packet.paymentScheduleNote}</p>
        </Section>

        <Section eyebrow="What happens after the $50" title="The trip can be active before an individual student is registered">
          <div className={styles.stageList}>{packet.registrationStages.map((row, index) => <article key={row.stage}><span>{index + 1}</span><div><h3>{row.stage}</h3><p>{row.answer}</p></div></article>)}</div>
          <h3 className={styles.subheading}>WorldStrides deadlines that drive the group plan</h3>
          <div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>What happens</th></tr></thead><tbody>{packet.vendorMilestones.map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.meaning}</td></tr>)}</tbody></table></div>
        </Section>

        <Section eyebrow="If plans change" title="What happens when an individual student withdraws">
          <div className={styles.stageList}>{packet.withdrawalStages.map((row, index) => <article key={row.stage}><span>{index + 1}</span><div><h3>{row.stage}</h3><p>{row.answer}</p></div></article>)}</div>
          <h3 className={styles.subheading}>Current standard cancellation bands without FRP</h3>
          <div className={styles.tableWrap}><table><thead><tr><th>Cancellation date</th><th>Current WorldStrides consequence</th></tr></thead><tbody>{packet.standardCancellation.map((row) => <tr key={row.date}><td>{row.date}</td><td>{row.result}</td></tr>)}</tbody></table></div>
          <p className={styles.note}>{packet.standardCancellationNote}</p>
        </Section>

        <Section eyebrow="Optional protection" title={packet.frp.title}>
          <p className={styles.lede}>{packet.frp.summary}</p>
          <div className={styles.twoColumn}><div><h3>What is confirmed</h3><ul>{packet.frp.known.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h3>What the final agreement still has to state</h3><ul>{packet.frp.open.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        </Section>

        <Section eyebrow="The shared campaign" title="Moving the family total toward $500 starts tonight">
          <p className={styles.lede}>{packet.funding.summary}</p>
          <ul>{packet.funding.actions.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className={styles.note}>{packet.funding.boundary}</p>
        </Section>

        <Section eyebrow="Before individual registration" title="These details still require written answers">
          <ul>{packet.openBeforeFinalAgreement.map((item) => <li key={item}>{item}</li>)}</ul>
        </Section>

        <Section eyebrow="Parent questions" title="Frequently asked questions">
          <div className={styles.faq}>{packet.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
        </Section>

        <section className={styles.finalAction}>
          <p className={styles.eyebrow}>Due Friday, September 4</p>
          <h2>Give the band program a reliable answer</h2>
          <p>Complete one response per student. A serious yes creates the connected $50 conditional-deposit charge and lets the family pay immediately.</p>
          <div className={styles.actions}><Link className={styles.primary} href="/carnegie-2027/commit">Sign and continue to payment</Link><a className={styles.secondary} href={PDF_PATH} download>Keep the PDF packet</a></div>
        </section>

        <footer className={styles.sources}><h2>Sources and status</h2><ul>{packet.sources.map((item) => <li key={item}>{item}</li>)}</ul><p>Planning information as of September 1, 2026. Estimates and open terms are labeled throughout.</p></footer>
      </div>
    </main>
  );
}
