import { Children, cloneElement, isValidElement, useId } from "react";
import styles from "./Field.module.css";

/**
 * One labeled form control.
 *
 * Wrap exactly one <input>, <select> or <textarea>. Field wires up the label (htmlFor/id), the hint
 * and error text (aria-describedby), aria-invalid, and required. Pass `id` to choose the control id.
 */
export default function Field({ label, hint, error, required = false, id, className, children }) {
  const autoId = useId();
  const control = Children.only(children);
  const controlId = id || control.props.id || `field-${autoId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hintId = hint ? `${controlId}-hint` : null;
  const errorId = error ? `${controlId}-error` : null;
  const describedBy = [control.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  const wired = isValidElement(control)
    ? cloneElement(control, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : control.props["aria-invalid"],
        required: required || control.props.required
      })
    : control;

  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
        {required ? <span className={styles.required}>(required)</span> : null}
      </label>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {wired}
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
