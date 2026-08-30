import { Field, StepIntro } from "./OnboardingFields";
import styles from "./onboarding.module.css";

export default function ContactStep({ form, update, official }) {
  return (
    <>
      <StepIntro eyebrow="Step 2 of 6" title="Student contact">
        School email is the standard contact. Add backup information below.
      </StepIntro>
      <div className={styles.officialSingle}>
        <span>Official school email</span><strong>{official?.schoolEmail || "jordan.ellis@student.nhcs.net"}</strong>
      </div>
      <div className={styles.formGrid}>
        <Field id="personalEmail" label="Personal email (optional)" hint="For summer or backup contact.">
          <input id="personalEmail" type="email" value={form.personalEmail} placeholder="you@example.com" onChange={(event) => update("personalEmail", event.target.value)} />
        </Field>
        <Field id="mobile" label="Student mobile number" hint="Emergency use.">
          <input id="mobile" type="tel" value={form.mobile} placeholder="(910) 555-0123" onChange={(event) => update("mobile", event.target.value)} />
        </Field>
      </div>
    </>
  );
}
