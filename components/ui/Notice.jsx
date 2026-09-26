import styles from "./Notice.module.css";

const TONES = new Set(["info", "deadline", "archived", "error", "success"]);

/**
 * A short boxed message.
 *
 * tone: "info" | "deadline" | "archived" | "error" | "success". The title must say the point in words;
 * color only backs it up. Pass role="alert" only for an error that appears after a user action.
 */
export default function Notice({ tone = "info", title, children, className, role, id }) {
  const toneClass = styles[TONES.has(tone) ? tone : "info"];
  return (
    <div className={[styles.notice, toneClass, className].filter(Boolean).join(" ")} role={role} id={id}>
      {title ? <p className={styles.title}>{title}</p> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
    </div>
  );
}
