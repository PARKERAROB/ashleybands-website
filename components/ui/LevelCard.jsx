import { ButtonLink } from "./Button";
import styles from "./LevelCard.module.css";

/**
 * One giving or price level: a name, the amount, what it includes, and one action (#153).
 *
 * name     the level name ("Partner"). Bold body type, not Cinzel.
 * amount   the price as shown ("$500", "$3,000+").
 * children what the level includes, usually a <ul>.
 * action   optional { href, label } for the one next step.
 * featured true outlines the card in gold. Use on one card per grid at most.
 * tag      optional short label for the featured card ("Best value").
 * headingLevel 2 to 4 (default 3).
 */
export default function LevelCard({ name, amount, children, action, featured = false, tag, headingLevel = 3, className }) {
  const Heading = `h${Math.min(4, Math.max(2, Number(headingLevel) || 3))}`;
  const classes = [styles.card, featured ? styles.featured : null, className].filter(Boolean).join(" ");

  return (
    <article className={classes}>
      {featured && tag ? <p className={styles.tag}>{tag}</p> : null}
      <Heading className={styles.name}>{name}</Heading>
      <p className={styles.amount}>{amount}</p>
      {children ? <div className={styles.body}>{children}</div> : null}
      {action?.href && action?.label ? (
        <p className={styles.action}>
          <ButtonLink href={action.href} variant={featured ? "primary" : "secondary"}>
            {action.label}
          </ButtonLink>
        </p>
      ) : null}
    </article>
  );
}

/** Lays LevelCards out in even columns that stack on a phone. */
export function LevelGrid({ children, className }) {
  return <div className={className ? `${styles.grid} ${className}` : styles.grid}>{children}</div>;
}
