import styles from "./CalloutPanel.module.css";

/**
 * A dark garnet panel for the one message a section should end on (#153).
 *
 * eyebrow  optional short gold label above the title.
 * title    the panel heading, set in the display serif.
 * children body text. Links inside are underlined in the panel's light text color.
 * actions  optional Button / ButtonLink. Inside the panel, primary turns gold and secondary turns light.
 * split    true puts the title on the left and the body on the right from tablet width up.
 * headingLevel 2 to 4 (default 2) so the panel fits the page outline.
 */
export default function CalloutPanel({ eyebrow, title, children, actions, split = false, headingLevel = 2, className, id }) {
  const Heading = `h${Math.min(4, Math.max(2, Number(headingLevel) || 2))}`;
  const classes = [styles.panel, split ? styles.split : null, className].filter(Boolean).join(" ");

  return (
    <section className={classes} id={id}>
      <div className={styles.head}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <Heading className={styles.title}>{title}</Heading>
      </div>
      {children || actions ? (
        <div className={styles.content}>
          {children ? <div className={styles.body}>{children}</div> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
