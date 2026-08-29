import styles from "./onboarding.module.css";

export function StepIntro({ eyebrow, title, children }) {
  return (
    <header className={styles.stepIntro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </header>
  );
}

export function Field({ id, label, hint, required = false, children }) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}{required ? <b aria-hidden="true"> *</b> : null}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function CheckboxCard({ checked, onChange, title, children }) {
  return (
    <label className={[styles.checkCard, checked ? styles.checkCardSelected : ""].join(" ")}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span><strong>{title}</strong>{children ? <small>{children}</small> : null}</span>
    </label>
  );
}

export function RadioCard({ name, value, checked, onChange, title, children }) {
  return (
    <label className={[styles.checkCard, checked ? styles.checkCardSelected : ""].join(" ")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span><strong>{title}</strong>{children ? <small>{children}</small> : null}</span>
    </label>
  );
}

export function ReviewGroup({ title, action, onEdit, children }) {
  return (
    <section className={styles.reviewGroup}>
      <header><h3>{title}</h3><button type="button" onClick={onEdit}>{action || "Edit"}</button></header>
      {children}
    </section>
  );
}

export function ReviewLine({ label, value }) {
  return <div className={styles.reviewLine}><span>{label}</span><strong>{value || "Not provided"}</strong></div>;
}
