import styles from "./StatusChip.module.css";

const LABELS = {
  needed: "Needed",
  done: "Done",
  closed: "Closed",
  waiting: "Waiting",
  info: "Info"
};

/**
 * A small status pill. status: "needed" | "done" | "closed" | "waiting" | "info".
 * The label is always visible text, so color is never the only signal. Children override the label.
 */
export default function StatusChip({ status = "info", children, className }) {
  const key = Object.hasOwn(LABELS, status) ? status : "info";
  return (
    <span className={[styles.chip, styles[key], className].filter(Boolean).join(" ")}>
      {children ?? LABELS[key]}
    </span>
  );
}
