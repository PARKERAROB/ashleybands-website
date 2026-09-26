import { ButtonLink } from "./Button";
import styles from "./EventCard.module.css";

const ROWS = [
  ["when", "When"],
  ["where", "Where"],
  ["who", "Who"],
  ["wear", "Wear"],
  ["bring", "Bring"],
  ["cost", "Cost"]
];

/**
 * One event, answering a parent's questions in a fixed order.
 *
 * title, when, where, who, wear, bring, cost: strings or nodes. Only the rows you pass are shown.
 * next: optional { href, label } for the one next step.
 * headingLevel: 2 to 4 (default 3) so the card fits the page outline.
 */
export default function EventCard({ title, when, where, who, wear, bring, cost, next, headingLevel = 3, className }) {
  const values = { when, where, who, wear, bring, cost };
  const Heading = `h${Math.min(4, Math.max(2, Number(headingLevel) || 3))}`;
  const shown = ROWS.filter(([key]) => values[key] !== undefined && values[key] !== null && values[key] !== "");

  return (
    <article className={className ? `${styles.card} ${className}` : styles.card}>
      <Heading className={styles.title}>{title}</Heading>
      {shown.length ? (
        <dl className={styles.rows}>
          {shown.map(([key, label]) => (
            <div className={styles.row} key={key}>
              <dt>{label}</dt>
              <dd>{values[key]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {next?.href && next?.label ? (
        <p className={styles.next}>
          <ButtonLink href={next.href} variant="secondary">
            {next.label}
          </ButtonLink>
        </p>
      ) : null}
    </article>
  );
}
