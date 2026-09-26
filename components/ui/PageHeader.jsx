import styles from "./PageHeader.module.css";

/**
 * The one heading treatment for public pages.
 *
 * eyebrow  optional short label above the title. Skip it when the title says enough.
 * title    the page h1 (string or node).
 * lede     one or two plain sentences under the title.
 * children optional extra body text between the lede and the actions.
 * actions  optional buttons or links (use Button / ButtonLink).
 * className lets the page set width and outer spacing.
 */
export default function PageHeader({ eyebrow, title, lede, actions, children, className, id }) {
  return (
    <header className={className ? `${styles.header} ${className}` : styles.header} id={id}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      {lede ? <p className={styles.lede}>{lede}</p> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
